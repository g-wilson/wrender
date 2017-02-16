const express = require('express');
const app = express();
const wrender = require('./index');

app.get('/favicon.ico', (req, res) => res.sendStatus(204));

app.use(wrender());

app.listen(3010, 'localhost', () => console.log('Server started on port 3010 😎'));
