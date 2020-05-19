#!/usr/bin/env node

const amqp = require('amqplib/callback_api');
const { Worker } = require('worker_threads');
const { isEmpty } = require('../utils/utils');
const { logger } = require('../utils/logger');

class AMQConnection {
    /**
     *
     * @param {Object} initial
     */
    constructor(initial = {}) {
        if (isEmpty(initial) || typeof initial !== 'object'
            || !!!initial.username || !!!initial.password || !!!initial.hostname || !!!initial.port
            || !!!initial.queueName) {
            throw new Error("username, password, hostname, port, queue must be exist")
        }

        this.connURL = `amqp://${initial.username}:${initial.password}@${initial.hostname}:${initial.port}?heartbeat=60`;
        this.queueName = initial.queueName;
    }

    /**
     * AMQ connection
     */
    run = () => {
        try {
            amqp.connect(this.connurl, this.connListener);
        } catch (error) {
            console.error(error);
            process.exit(1);
        }
    }

    /**
     * Connect to AMQ
     *
     * @param {Error} errConn
     * @param {any} conn
     */
    connListener = (errConn, conn) => {
        if (errConn) {
            throw errConn;
        }

        conn.on("error", function (err) {
            console.error("[AMQP] conn error", err.message);
        });
        conn.on("close", function () {
            console.error("[AMQP] closed");
            // return setTimeout(start, 1000);
        });

        conn.createChannel(this.chanListener)
    }

    /**
     * Connect to AMQ's channel
     *
     * @param {Error} errChan
     * @param {any} channel
     */
    chanListener = async (errChan, channel) => {
        if (errChan) {
            throw errChan;
        }

        channel.assertQueue(this.queueName, {
            durable: false
        });

        channel.on("error", function (err) {
            channelconsole.error("[AMQP] channel error", err.message);
        });
        channel.on("close", function () {
            console.log("[AMQP] channel closed");
        });

        console.log(" [*] Waiting for messages in %s. To exit press CTRL+C", this.queueName);

        await channel.consume(this.queueName, async (encodedMessage) => {
            const status = await this.queueConsumer(encodedMessage);

            if (!status) {
                channel.nack(encodedMessage);
                return;
            }

            channel.ack(encodedMessage);
        });
    }

    /**
     * Message processing
     *
     * @param {Object} encodedMessage (fields, properties, content)
     */
    queueConsumer = (encodedMessage) => {
        return new Promise((successCallback, failureCallback) => {
            const body = encodedMessage.content.toString();
            const wkr = new Worker(`${__dirname}/../puppeteer/${this.queueName}.js`, { workerData: body });

            wkr.on('message', (data) => {
                logger("message", data);
                wkr.terminate()
            })
            wkr.on('error', (err) => {
                console.error(err);
                failureCallback(false)
            })
            wkr.on('exit', (code) => {
                logger("exit", code);
                successCallback(true)
            })
        })
    }
}

exports.AMQConnection = AMQConnection;
