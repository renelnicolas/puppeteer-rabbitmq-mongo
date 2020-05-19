const puppeteer = require('puppeteer');
const crypto = require('crypto');

// Custom entity
const eCookie = require('../entity/cookie');
const eResponse = require('../entity/response');

// MongoDB
const _ = require('../models/database');
const Analyser = require('../models/analyser');

// Extra functions
const parseBool = (value) => {
    return (value === 'true' || value === true)
}

const parseOptionalTime = (timing, start, end) => {
    if (timing[start] >= 0) {
        return formatMillis(timing[end] - timing[start]);
    }
    return -1;
}

const formatMillis = (time, fractionalDigits = 3) => {
    return Number(Number(time).toFixed(fractionalDigits));
}

const firstNonNegative = (values) => {
    for (let i = 0; i < values.length; ++i) {
        if (values[i] >= 0) {
            return values[i];
        }
    }
    return -1;
}

const extractTiming = (timing) => {
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

// >>> Program

// custom timeout
const timeout = process.env.TIMEOUT * 1000 || 0;
// custom process timeout
const processTimeout = (process.env.PROCESS_TIMEOUT || 90) * 1000;
// custom headless
const headless = parseBool(process.env.hasOwnProperty("HEADLESS") ? process.env.HEADLESS : true);
// custom executablePath
const executablePath = process.env.hasOwnProperty("EXECPATH") ? process.env.EXECPATH : null;
// custom executablePath
const isDebug = parseBool(process.env.hasOwnProperty("DEBUG") ? process.env.DEBUG : true);

// event types to observe
const observe = [
    'Page.loadEventFired',
    'Page.domContentEventFired',
    'Page.frameStartedLoading',
    'Page.frameAttached',
    'Network.getResponseBody',
    'Network.requestWillBeSent',//! --> headers
    'Network.requestServedFromCache',
    'Network.dataReceived',
    'Network.responseReceived', //! --> headers (Cookie not all)
    'Network.loadingFinished',
    'Network.loadingFailed',
    'Network.responseReceivedExtraInfo'
];

let events = [];
let requests = [];

let browser = null;

const logger = (...rest) => {
    if (isDebug) {
        console.log("==============");
        console.log(rest);
    }
}

const run = async () => {
    // Running as root without --no-sandbox is not supported. See https://crbug.com/638180.
    browser = await puppeteer.launch({
        executablePath: '/Applications/Google Chrome.app/Contents/MacOS/Google Chrome',
        headless: headless,
        defaultViewport: null,
        devtools: true,
        args: ['--no-sandbox', '--disable-setuid-sandbox', '--window-size=1920,1170', '--window-position=0,0', '--lang=en-GB,en', '--disable-dev-shm-usage']
    });

    const [page] = await browser.pages();

    page.on('load', () => console.log('Page loaded : ' + page.url()));

    page.setDefaultNavigationTimeout(timeout);
    await page.setRequestInterception(true);
    await page.setCacheEnabled(false);
    await page.setExtraHTTPHeaders({
        'Accept-Language': 'fr,fr-FR;q=0.8,en-US;q=0.5,en;q=0.3',
        'Accept-Encoding': 'gzip, deflate, br',
    });

    const logRequest = (eventRequest) => {
        eventRequest.continue();
    }
    page.on('request', logRequest);

    // register events listeners
    const session = await page.target().createCDPSession();
    await session.send('Page.enable');
    await session.send('Network.enable');

    observe.forEach(method => {
        session.on(method, params => {
            events.push({ method, params });
        });
    });

    const logResponse = async (eventResponse) => {
        const url = eventResponse.url();

        if (/^data:image/.test(url)) {// data:image/png;base64
            return;
        }

        logger('===> logResponse : A request was made :', url);

        const response = eventResponse;
        const frame = response.frame();
        const request = response.request();

        let content = '';

        await response.text()
            .then(result => content = result)
            .catch(_ => true)

        // type HexBase64Latin1Encoding = "latin1" | "hex" | "base64"
        const urlHash = crypto.createHash('sha1').update(url, 'utf8').digest("hex")
        const postData = request.postData() ? request.postData() : null;

        requests.push(new eResponse({
            at: (new Date().getTime()),
            // --- response
            url: url,
            urlHash: urlHash,
            headers: response.headers(),
            remoteAddress: response.remoteAddress(),
            fromCache: response.fromCache(),
            status: response.status(),
            statusText: response.statusText(),
            ok: response.ok(),
            content: content,
            // --- frame
            isDetached: frame.isDetached(),
            frameId: frame._id,
            // --- request
            isNavigationRequest: request.isNavigationRequest(),
            method: request.method(),
            postData: postData,
            resourceType: request.resourceType(),
            requestId: request._requestId,
            timing: {},
            cookies: [],
            extras: {},
        }));
    }
    page.on('response', logResponse);

    await page.setUserAgent('Mozilla/5.0 (Macintosh; Intel Mac OS X 10_15_4) AppleWebKit/537.36 (KHTML, like Gecko) Chrome/81.0.4044.113 Safari/537.36');

    await page.goto("http://api.ohmytech.local/static/vastplayer.html")

    // await page.waitForNavigation("networkidle0");
    await browser.waitForTarget(() => false);
}

const close = async (brow, status, message) => {
    logger(status, message);

    const copyRequests = requests.map(request => {
        const requestId = request.requestId;

        const responseReceivedFieldName = 'Network.responseReceived';
        const responseReceived = events.find(info => responseReceivedFieldName === info.method && requestId === info.params.requestId)

        if (responseReceived) {
            request.timing = extractTiming(responseReceived.params.response.timing);

            request.extras = { ...request.extras, 'NetworkTiming': responseReceived.params.response.timing }
        }

        const responseReceivedExtraInfoFieldName = 'Network.responseReceivedExtraInfo';
        const responseReceivedExtraInfo = events.find(info => responseReceivedExtraInfoFieldName === info.method && requestId === info.params.requestId);

        if (responseReceivedExtraInfo) {
            delete responseReceivedExtraInfo.params.headersText;

            request.extras = { ...request.extras, responseReceivedExtraInfoFieldName: responseReceivedExtraInfo }

            if (responseReceivedExtraInfo.params.headers['Set-Cookie']) {
                const cookies = responseReceivedExtraInfo.params.headers['Set-Cookie'].split('\n');

                request.cookies = cookies.map(cookie => {
                    return new eCookie(cookie)
                });
            }
        }

        return new Analyser(request);
    });

    await Analyser.insertMany(copyRequests)
        .catch(error => console.error('Analyser.insertMany', error))

    await brow.close()
        .then(/* TODO */)
        .catch(/* TODO */)
        .finally(console.log("end process"))
}

// process.on("SIGINT", async () => {
//     logger(`process.on="exit properly"`);
// });

const processTimeoutFunction = async () => {
    await close(browser, 'ProcessTimeout', "<<<");
    // process.kill(process.pid, 'SIGINT');
}

setTimeout(processTimeoutFunction, processTimeout);

await run()
    .then(async result => await close(browser, 'Then :', result))
    .catch(async error => await close(browser, 'Catch :', 'TimeoutError' !== error.name ? error : `Navigation timeout of ${timeout} ms exceeded`))
