const mongoose = require('mongoose');

const resumeSchema = mongoose.Schema({
    workId: String,
    scheduleId: String,
    scheduleHistoryId: String,
    companyId: Number,
    at: Number,
    date: { type: Date, default: Date.now },
    url: String,
    urlHash: String,
    requestCount: Number,
    loadTime: Number,
    cookies: [],
    domains: [],
});

module.exports = mongoose.model('Resume', resumeSchema);
