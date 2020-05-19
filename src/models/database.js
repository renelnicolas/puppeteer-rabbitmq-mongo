const mongoose = require('mongoose');

// Database infos
const hostname = 'localhost';
const port = 27017;
const database = 'puppeteer';

// Database URL
const connurl = `mongodb://${hostname}:${port}/${database}`;

// Recommanded options
const options = {
    useNewUrlParser: true,
    useUnifiedTopology: true
};

mongoose.connect(connurl, options);

mongoose.connection
    .on('error', console.error.bind(console, 'Erreur lors de la connexion'));
