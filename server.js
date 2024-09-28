import express from 'express';

const routes = require('./routes/index');

const port = process.env.PORT || 5000;
const app = express();

app.use('/', routes);

app.listen(port);

module.exports = app;
