const fs = require('fs');
const express = require('express');
const readChunk = require('read-chunk');
const imageType = require('image-type');
const sharp = require('sharp');
const micromatch = require('micromatch');
const pathToRegexp = require('path-to-regexp');

const blank = new Buffer('iVBORw0KGgoAAAANSUhEUgAAAAEAAAABCAYAAAAfFcSJAAAADUlEQVR42mP8/5+hHgAHggJ/PchI7wAAAABJRU5ErkJggg==', 'base64');
const configureRequests = require('./lib/request');
const errors = require('./lib/errors');

module.exports = function (config) {
  config = Object.assign({
    quality: 85,
    convertGIF: true,
    convertPNG: true,
    includeEXIF: false,
    maxWidth: 3000,
    maxHeight: 3000,
    maxAge: 31536000, // ~1y
    timeout: 10000,
    rewritesOnly: false,
    hostWhitelist: [],
    hostBlacklist: [],
    rewrites: [],
  }, config || {});

  // Build RegExp objects here (on-boot) for performance
  if (Array.isArray(config.rewrites) && config.rewrites.length) {
    config.rewrites = config.rewrites.map(rewrite => {
      rewrite.regexp = pathToRegexp(rewrite.path);
      return rewrite;
    });
  }

  const middleware = [];
  const request = configureRequests(config);
  const router = express.Router();

  /**
   * Source handler
   */
  middleware.push((req, res, next) => {
    req.wrender = {};

    if (config.userAgent && req.headers['user-agent'] !== config.userAgent) {
      return next(errors.ArgumentError('USER_AGENT_FORBIDDEN', new Error('User Agent forbidden')));
    }
    if (req.params.width > config.maxWidth || req.params.height > config.maxHeight) {
      return next(errors.ArgumentError('SRC_TOO_LARGE', new Error('Requested image too large')));
    }
    if (config.hostWhitelist.length && !micromatch.any(req.params.source, config.hostWhitelist)) {
      return next(errors.ArgumentError('INVALID_SRC_URL', new Error('Invalid remote URL')));
    }
    if (config.hostBlacklist.length && micromatch.any(req.params.source, config.hostBlacklist)) {
      return next(errors.ArgumentError('INVALID_SRC_URL', new Error('Invalid remote URL')));
    }

    if (!Array.isArray(config.rewrites) || !config.rewrites.length) {
      if (config.rewritesOnly) return next(errors.ArgumentError('INVALID_SRC_URL', new Error('Remote URL does not match any sources')));
    } else {
      // Check rewrites.
      // If one is found, modify the source param to the origin source URL.
      let matchFound = false;
      config.rewrites.forEach(alias => {
        if (matchFound) return;
        const matches = (`/${req.params.source}`).match(alias.regexp);
        if (!matches) return;
        matchFound = true;

        req.params.source = alias.origin + matches[1];
        if (alias.request) req.wrender.requestOpts = Object.assign({}, alias.request);
      });

      if (config.rewritesOnly && !matchFound) {
        return next(errors.ArgumentError('INVALID_SRC_URL', new Error('Remote URL does not match any sources')));
      }
    }

    req.wrender.requestOpts = req.wrender.requestOpts || {};
    req.wrender.requestOpts.url = req.params.source;

    request.fetchSourceMiddleware(req, res, next);
  });

  /**
   * Prepare Sharp for image processing
   */
  middleware.push((req, res, next) => {
    const type = imageType(readChunk.sync(req.wrender.temp.path, 0, 12)); // First 12 bytes contains the mime type header
    if (!type) return next(errors.ArgumentError('INVALID_IMG', new Error(`Source file is not an image: ${req.originalUrl}`)));

    req.wrender.mimetype = type.mime;
    req.params.quality = config.quality;
    req.wrender.source = fs.createReadStream(req.wrender.temp.path);
    req.wrender.source.on('error', next);

    // If we are not converting GIFs we must direct proxy the image. Sharp cannot process (animated) GIFs.
    if (!config.convertGIF && req.wrender.mimetype === 'image/gif') return next();

    req.wrender.recipe = sharp();
    req.wrender.recipe
      .on('error', next)
      .on('finish', () => fs.unlink(req.wrender.source.path));

    // Convert to JPEG? GIFs become still-frames
    if (
      req.wrender.mimetype !== 'image/jpeg' &&
      (config.convertGIF && req.wrender.mimetype === 'image/gif') &&
      (config.convertPNG && req.wrender.mimetype === 'image/png')
    ) {
      req.wrender.recipe.background({ r: 0, g: 0, b: 0, alpha: 0 });
      req.wrender.recipe.flatten();
      req.wrender.recipe.toFormat(sharp.format.jpeg);
      req.wrender.mimetype = 'image/jpeg';
    }

    // Respect EXIF orientation headers
    if (req.wrender.mimetype === 'image/jpeg') {
      req.wrender.recipe.rotate();
    }

    next();
  });

  /**
   * Recipes
   */
  router.get('/proxy/:source(*)', middleware);
  router.get('/resize/:width/:height/:source(*)', middleware, (req, res, next) => {
    req.wrender.recipe.resize(parseInt(req.params.width, 10), parseInt(req.params.height, 10));
    req.wrender.recipe.ignoreAspectRatio();
    next();
  });
  router.get('/resizex/:width/:source(*)', middleware, (req, res, next) => {
    req.wrender.recipe.resize(parseInt(req.params.width, 10));
    next();
  });
  router.get('/resizey/:height/:source(*)', middleware, (req, res, next) => {
    req.wrender.recipe.resize(null, parseInt(req.params.height, 10));
    next();
  });
  router.get('/crop/:width/:height/:source(*)', middleware, (req, res, next) => {
    req.wrender.recipe
      .resize(parseInt(req.params.width, 10), parseInt(req.params.height, 10))
      .crop(sharp.gravity.center);
      // .crop(sharp.strategy.entropy);
      // .crop(sharp.strategy.attention);
    next();
  });

  /**
   * Response handler
   */
  router.use((req, res, next) => {
    if (!req.wrender) return next(errors.NotFoundError(null, 'Wrender not found'));

    res.setHeader('Content-Type', req.wrender.mimetype);
    res.setHeader('Cache-Control', `public, max-age=${config.maxAge}`);

    // Recipe not defined, pipe the source directly to output
    if (!req.wrender.recipe) return req.wrender.source.pipe(res);

    // Always apply compression at the end
    if (req.wrender.mimetype === 'image/jpeg') {
      req.wrender.recipe.jpeg({ quality: req.params.quality });
    }

    // Discard EXIF
    if (config.includeEXIF === true) {
      req.wrender.recipe.withMetadata();
    }

    // Go!
    req.wrender.source.pipe(req.wrender.recipe);
    req.wrender.recipe.pipe(res);
  });

  /**
   * Error handler
   */
  // eslint-disable-next-line no-unused-vars
  router.use((err, req, res, next) => {
    if (req.wrender && req.wrender.source) {
      fs.unlink(req.wrender.source.path);
    }

    // eslint-disable-next-line no-console
    if (process.env.NODE_ENV === 'development') console.error(err);

    res
      .status(err.status || 500)
      .set({
        'Content-Type': 'image/png',
        'Content-Length': blank.length,
        'X-Wrender-Error': err.message
      })
      .send(blank);
  });

  return router;
};
