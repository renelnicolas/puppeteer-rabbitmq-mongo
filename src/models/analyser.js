const mongoose = require('mongoose');

const analyserSchema = mongoose.Schema({
    workId: String,
    companyId: Number,
    at: Number,
    url: String,
    urlExtras: mongoose.Schema.Types.Mixed,
    urlHash: String,
    headers: mongoose.Schema.Types.Mixed,
    remoteAddress: {
        ip: String,
        port: Number
    },
    fromCache: Boolean,
    status: Number,
    statusText: String,
    ok: Boolean,
    content: String,
    isDetached: Boolean,
    frameId: String,
    isNavigationRequest: Boolean,
    method: String,
    postData: [],
    resourceType: String,
    requestId: String,
    timing: mongoose.Schema.Types.Mixed,
    cookies: [],
    extras: mongoose.Schema.Types.Mixed
});

module.exports = mongoose.model('Analyser', analyserSchema);
