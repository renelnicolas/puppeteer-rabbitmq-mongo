const { v4: uuidv4 } = require('uuid');
const { formatMillis, firstNonNegative, parseOptionalTime } = require('../utils/utils');

const uuid = uuidv4();
const defaultConfig = {
    id: 1,
    name: 'demo',
    url: process.env.URL || 'http://api.ohmytech.local/static/vastplayer.html',
    url_hash: 'a005e03a30a81f7897630d51ad1678c0e2fb42fe',
    enabled: true,
    external_id: 'external_id',
    config: {
        user_agent: 'Mozilla/5.0 (Macintosh; Intel Mac OS X 10_15_4) AppleWebKit/537.36 (KHTML, like Gecko) Chrome/81.0.4044.113 Safari/537.36',
    },
    queue_schedule_history: {
        id: 1,
        uuid: uuid,
        status: 0,
        scheduled_start_date: '',
        scheduled_end_date: '',
        queue_scheduler_id: 5
    },
    queue_type: {
        id: 1,
        name: 'analyser',
        config: {},
        enabled: false,
        external_id: 'external_id',
    },
    company: {
        id: 1,
        name: 'Company 1',
        enabled: true,
        external_id: 'external_id',
        country: { id: 1, name: 'France', iso: 'FR' }
    }
}

/**
 * Calculus conmplete timing
 *
 * @param {Object} timing
 * return Object
 */
exports.extractTiming = (timing) => {
    const blocked = formatMillis(
        firstNonNegative([timing.dnsStart, timing.connectStart, timing.sendStart])
    );

    const dns = parseOptionalTime(timing, 'dnsStart', 'dnsEnd');
    const connect = parseOptionalTime(timing, 'connectStart', 'connectEnd');
    const send = formatMillis(timing.sendEnd - timing.sendStart);
    const wait = formatMillis(timing.receiveHeadersEnd - timing.sendEnd);
    const receive = 0;
    const ssl = parseOptionalTime(timing, 'sslStart', 'sslEnd');
    const time = Math.max(0, blocked) + Math.max(0, dns) + Math.max(0, connect) + send + wait + receive;

    return {
        blocked: blocked,
        dns: dns,
        connect: connect,
        send: send,
        wait: wait,// Latency
        receive: receive,
        ssl: ssl,// TLS Handshake
        time: time// Duration
    };
}

/**
 * Calculus conmplete timing
 *
 * return String
 */
exports.chromePath = () => {
    const executablePath = process.env.hasOwnProperty("EXECPATH") ? process.env.EXECPATH : null;

    if (null == executablePath) {
        // 'darwin', 'freebsd', 'linux', 'sunos', 'win32'
        switch (process.platform) {
            case 'darwin':
                return '/Applications/Google Chrome.app/Contents/MacOS/Google Chrome'
            case 'freebsd':
            case 'linux':
                return '/usr/bin/google-chrome'
            default:
                // 'sunos', 'win32'
                throw new Error("Chrome path unknown");
        }
    }

    return executablePath
}

/**
 * Extract config from args
 *
 * return Object
 */
exports.extractConfig = (workerData) => {
    if (workerData) {
        return JSON.parse(workerData);
    }

    return defaultConfig;
}
