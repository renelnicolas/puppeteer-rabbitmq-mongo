const { parentPort, workerData, threadId, isMainThread } = require('worker_threads');
const puppeteer = require('puppeteer');
const crypto = require('crypto');
const { v4: uuidv4 } = require('uuid');

// Custom functions
const { extractTiming, chromePath, extractConfig } = require('../utils/puppeteer');
const { parseBool } = require('../utils/utils');
const { logger } = require('../utils/logger');
const { extractInfosFromUrl } = require('../utils/url');


// Custom entity
const eCookie = require('../entity/cookie');
const eResponse = require('../entity/response');

// MongoDB
const _ = require('../models/database');
const Analyser = require('../models/analyser');
const Resume = require('../models/resume');

logger('worker = This worker is your threadId :', threadId);

// >>> Program

// custom timeout
const timeout = process.env.TIMEOUT * 1000 || 0;
// custom process timeout
const processTimeout = (process.env.PROCESS_TIMEOUT || 20) * 1000;
// custom headless
const headless = parseBool(process.env.hasOwnProperty("HEADLESS") ? process.env.HEADLESS : true);

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

const config = extractConfig(workerData);

let events = [];
let requests = [];
let domains = [];

let browser = null;
let session = null;

let loadTime = -1;
let requestCount = 0;

const workId = uuidv4();

/**
 * Main process
 */
const run = async () => {
    logger("extractConfig", config);

    // Running as root without --no-sandbox is not supported. See https://crbug.com/638180.
    browser = await puppeteer.launch({
        // Use chrome for video playing, Video didn't work with chronium
        executablePath: chromePath(),
        headless: headless,
        defaultViewport: null,
        devtools: true,
        args: ['--no-sandbox', '--disable-setuid-sandbox', '--window-size=1920,1170', '--window-position=0,0', '--lang=en-GB,en', '--disable-dev-shm-usage']
    });

    const [page] = await browser.pages();

    page.on('load', () => logger('Page loaded : ' + page.url()));

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
    session = await page.target().createCDPSession();
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
        const urlExtras = extractInfosFromUrl(url);

        if (-1 === domains.indexOf(urlExtras.hostname)) {
            domains.push(urlExtras.hostname)
        }

        requests.push(new eResponse({
            at: (new Date().getTime()),
            // workId: workId,
            companyId: config.company.id,
            // --- response
            url: url,
            urlHash: urlHash,
            urlExtras: urlExtras,
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

    if (config.config.user_agent) {
        await page.setUserAgent(config.config.user_agent);
    }

    await page.goto(config.url, {
        // type LoadEvent = "networkidle2" | "load" | "domcontentloaded" | "networkidle0"
        waitUntil: 'load'
    })

    const perf = await page.evaluate(() => {
        const { loadEventEnd, navigationStart } = performance.timing

        return ({
            loadTime: loadEventEnd - navigationStart
        })
    })

    loadTime = perf.loadTime;

    logger(`Page load took: ${perf.loadTime} ms`);

    // await page.waitForNavigation("networkidle0");
    await browser.waitForTarget(() => false);

    return;
}

const close = async (brow, status, message) => {
    logger(status, message);

    const allCookies = await session.send('Network.getAllCookies');
    const cookies = allCookies.cookies.map(cookie => {
        return new eCookie(cookie)
    });

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

        request.workId = workId;

        return new Analyser(request);
    });

    const resumeAnalyse = new Resume({
        workId: workId,
        scheduleId: config.external_id,
        scheduleHistoryId: config.queue_schedule_history.uuid,
        companyId: config.company.id,
        at: (new Date().getTime()),
        url: config.url,
        urlHash: config.url_hash,
        requestCount: requestCount,
        loadTime: loadTime,
        cookies: cookies,
        domains: domains,
    });

    await resumeAnalyse.save()
        .catch(error => console.error('Resume.insert', error))

    await Analyser.insertMany(copyRequests)
        .catch(error => console.error('Analyser.insertMany', error))

    if (brow) {
        await brow.close()
            /* TODO */
            .then(_ => true)
            .catch(_ => true)
            .finally(() => {
                if (parentPort && !isMainThread) {
                    parentPort.postMessage({ status: status })
                }

                if (isMainThread) {
                    process.exit();
                }
            })
    } else {
        if (parentPort && !isMainThread) {
            parentPort.postMessage({ status: status })
        }

        if (isMainThread) {
            process.exit();
        }
    }
}

const processTimeoutFunction = async () => {
    await close(browser, 'TimeoutProcess', "<<<");
}

setTimeout(processTimeoutFunction, processTimeout);

run()
    .then(async result => await close(browser, 'Done', result))
    .catch(async error => {
        let status = "Error";
        let message = error;

        if ('TimeoutError' === error.name) {
            status = 'TimeoutBrowser'
            message = `Navigation timeout of ${timeout} ms exceeded`
        }

        logger("END PROCESS", status, message)

        await close(browser, status, message)
    })
