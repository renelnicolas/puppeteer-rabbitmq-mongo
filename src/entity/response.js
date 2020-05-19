class Response {
    jobId = null
    companyId = null
    at = null
    url = null
    urlHash = null
    headers = null
    remoteAddress = null
    fromCache = null
    status = null
    statusText = null
    ok = null
    content = null
    isDetached = null
    frameId = null
    isNavigationRequest = null
    method = null
    postData = null
    resourceType = null
    requestId = null
    timing = {}
    cookies = []
    extras = {}

    constructor(initial = {}) {
        Object.keys(initial).filter(key => key in this).forEach(key => {
            this[key] = initial[key];
        });
    }
}

module.exports = Response
