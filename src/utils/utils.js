/**
 * Check if object is empty
 *
 * @param {Object} data
 * return Boolean
 */
exports.isEmpty = (data) => {
    return undefined === data || Object.keys(data).length === 0;
}

/**
 * Force to boolean value
 *
 * @param {Any} data
 * return Boolean
 */
exports.parseBool = (value) => {
    return (value === 'true' || value === true)
}

/**
 * Extract specific duration
 *
 * @param {Object} timing
 * @param {String} start
 * @param {String} end
 * return Number
 */
exports.parseOptionalTime = (timing, start, end) => {
    if (timing[start] >= 0) {
        return formatMillis(timing[end] - timing[start]);
    }
    return -1;
}

/**
 * Convert to milliseconde
 *
 * @param {Number} time
 * @param {Number} fractionalDigits
 * return Number
 */
const formatMillis = (time, fractionalDigits = 3) => {
    return Number(Number(time).toFixed(fractionalDigits));
}

exports.formatMillis = formatMillis;

/**
 * Find time with first negative number
 *
 * @param {Array} values
 * return Number
 */
exports.firstNonNegative = (values) => {
    for (let i = 0; i < values.length; ++i) {
        if (values[i] >= 0) {
            return values[i];
        }
    }
    return -1;
}
