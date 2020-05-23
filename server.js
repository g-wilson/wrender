const express = require('express');
const http = require('http');
const wrender = require('./src');

process.env.WRENDER_HTTP_PORT = process.env.WRENDER_HTTP_PORT || 3010;

const app = express();
const server = http.createServer(app);

app.get('/favicon.ico', (req, res) => res.sendStatus(204));
app.use(require('morgan')('tiny'));

app.use(wrender({
  convertPNG: false,
  onError: e => { console.error(e); }, // eslint-disable-line no-console
  recipes: [
    wrender.recipes.resize,
    wrender.recipes.crop,
    wrender.recipes.proxy,
  ],
  origins: [
    wrender.origins.identicon({ invert: true }),
    wrender.origins.initials(),
    wrender.origins.http({ prefix: '/http' }),
  ],
}));

server.on('error', err => {
  if (err.syscall === 'listen') switch (err.code) {
    case 'EACCES':
      err.message = `Port ${process.env.WRENDER_HTTP_PORT} requires elevated privileges`;
      break;
    case 'EADDRINUSE':
      err.message = `Port ${process.env.WRENDER_HTTP_PORT} is already in use`;
      break;
  }
  throw err;
});

server.on('listening', () => {
  const { address, port } = server.address();
  console.log('Server started on http://%s:%d 😎', address, port); // eslint-disable-line no-console
});

process.on('SIGINT', () => process.exit(0));

process.once('uncaughtException', err => {
  console.error(err); // eslint-disable-line no-console
  process.exit(1);
});

server.listen(process.env.WRENDER_HTTP_PORT, '0.0.0.0');
