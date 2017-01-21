const express = require('express');
const app = express();
const wrender = require('./index');
app.use(wrender());
app.get('/favicon.ico', (req, res) => res.send(204));
app.listen(3010, () => console.log('Server started on port 3010 😎'));
