const url = require('url');


/**
 * Extract all informations from url
 *
 * @param {string} value
 * return object
 */
exports.extractInfosFromUrl = (value) => {
    return url.parse(value)
}

/**
 * Extract Hostname from url
 *
 * @param {string} value
 * return string
 */
exports.extractHostname = (value) => {
    console.log(url.parse(value));
    return url.parse(value).hostname
}
