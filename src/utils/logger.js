const { parseBool } = require('../utils/utils');

const isDebug = parseBool(process.env.hasOwnProperty("DEBUG") ? process.env.DEBUG : false);

/**
 * Print log
 *
 * @param  {...any} rest
 */
exports.logger = (...rest) => {
    if (isDebug) {
        console.log("==============");
        console.log(rest);
    }
}
