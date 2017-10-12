const express = require('express');
const http = require('http');
const path = require('path');
const request = require('request');
const util = require('util');
const wrender = require('./index');

const app = express();
const server = http.createServer(app);

app.get('/favicon.ico', (req, res) => res.sendStatus(204));
app.use(require('morgan')('tiny'));

app.use(wrender({
  recipes: Object.keys(wrender.recipes).map(k => wrender.recipes[k]).concat([
    wrender.createRecipe('/mirror/:origin', image => {
      wrender.invokeRecipe(wrender.recipes.resize, image, { width: 200, height: 200 });
      image.flop();
    }),
  ]),
  origins: [
    wrender.createOrigin('/fb/:profile_id', ({ profile_id }) => request({
      url: util.format('https://graph.facebook.com/%d/picture', profile_id),
      qs: { width: 1024, height: 1024 },
    })),
    wrender.origins.fs({
      prefix: '/fs',
      mount: path.join(__dirname, 'tests/fixtures'),
    }),
    wrender.origins.http({
      blacklist: [ 'hack.thepla.net' ],
    }),
  ],
}));

server.on('error', err => {
  if (err.syscall === 'listen') switch (err.code) {
    case 'EACCES':
      err.message = `Port ${config.http.port} requires elevated privileges`;
      break;
    case 'EADDRINUSE':
      err.message = `Port ${config.http.port} is already in use`;
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

server.listen(3010, '0.0.0.0');
