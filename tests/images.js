const assert = require('assert');
const debug = require('debug')('wrender:tests:images');
const express = require('express');
const fs = require('fs');
const http = require('http');
const images = module.exports = {};
const path = require('path');
const serveStatic = require('serve-static');
const sharp = require('sharp');

images.assertHeaders = function ({ headers }) {
  assert.equal(headers['content-type'], 'image/png');
  assert.equal(headers['x-wrender-error'], undefined);
};

images.createExpressApp = function (route) {
  const app = express();
  app.use(route);
  return app;
};

images.getArtifactsPath = function (file) {
  return path.join(__dirname, 'artifacts', file);
};

images.getFixturesPath = function (file) {
  return path.join(__dirname, 'fixtures', file);
};

images.run = function (opts, callback) {
  // Confirm our inputs to this function are sane
  assert.equal(typeof opts, 'object', 'Expected opts to be an object');
  if (opts.recipe && opts.recipe.path && opts.recipe.recipe) opts.recipe = opts.recipe.recipe
  assert.equal(typeof opts.recipe, 'function', 'Expected opts.recipe to be a function');
  assert.equal(typeof opts.source, 'string', 'Expected opts.source to be a string');
  assert.equal(typeof opts.dest, 'string', 'Expected opts.dest to be a string');

  // Create the Sharp instance & the streams
  const image = sharp();
  const source = fs.createReadStream(images.getFixturesPath(opts.source));
  const dest = fs.createWriteStream(images.getArtifactsPath(opts.dest));

  // Attach error events to catch them
  image.on('error', err => dest.emit('error', err));
  source.on('error', err => dest.emit('error', err));

  // Handle callback correctly
  dest.on('error', err => callback(err));
  dest.on('finish', () => callback());

  // Run the recipe
  opts.recipe(image, opts.params || {});

  // Connect the pipes and run!
  source.pipe(image);
  image.pipe(dest);
};

images.staticFixturesServer = function (callback) {
  const app = images.createExpressApp(serveStatic(images.getFixturesPath(''), {
    dotfiles: 'ignore',
    etag: 'false',
    redirect: false,
  }));

  const server = http.createServer(app);
  server.listen(0, 'localhost', () => {
    debug('Server listening on ' + server.address().hostname + ':' + server.address().port);
    callback({
      port: server.address().port,

      server,
      app,
    });
  });
};
