#!/usr/bin/env node

/**
 * node src/amq/consumers/analyser.js
 * pm2 delete "amq-analyser"
 * dev : pm2 start src/amq/consumers/analyser.js --watch --name "amq-analyser"
 * pm2 start src/amq/consumers/analyser.js --name "amq-analyser" --restart-delay=200
 */
const { AMQConnection } = require('../connection');

/**
 * TODO : load credentials from .env
 */

// AMQ infos
const hostname = 'localhost';
const port = 5672;
const username = 'guest';
const password = 'guest';

// AMQ Current queue name
const queueName = 'analyser';

const conn = new AMQConnection({ username: username, password: password, hostname: hostname, port: port, queueName: queueName });

conn.run();
