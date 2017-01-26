const fs = require('fs');
const express = require('express');
const temp = require('temp').track();
const readChunk = require('read-chunk');
const imageType = require('image-type');
const request = require('request');
const sharp = require('sharp');
const micromatch = require('micromatch');

const blank = new Buffer('iVBORw0KGgoAAAANSUhEUgAAAAEAAAABCAYAAAAfFcSJAAAADUlEQVR42mP8/5+hHgAHggJ/PchI7wAAAABJRU5ErkJggg==', 'base64');

const createError = (status, msg) => {
  const err = new Error(msg);
  err.status = status;
  return err;
};

module.exports = function (config) {
  config = config || {};
  config = Object.assign({
    quality: 85,
    convertGIF: true,
    convertPNG: true,
    includeEXIF: false,
    maxWidth: 3000,
    maxHeight: 3000,
    maxAge: 31536000, // ~1y
    timeout: 10000,
    hostWhitelist: [],
    hostBlacklist: [],
  }, config);

  const router = express.Router();

  /**
   * Source handler
   */
  const fetchSource = (req, res, next) => {
    const stream = temp.createWriteStream();
    stream.on('error', next);
    stream.on('finish', () => {
      const type = imageType(readChunk.sync(stream.path, 0, 12)); // First 12 bytes contains the mime type header
      if (!type) return next(createError(400, `Source file is not an image: ${req.originalUrl}`));

      req.wrender = {};
      req.wrender.mimetype = type.mime;
      req.params.quality = config.quality;
      req.wrender.source = fs.createReadStream(stream.path);
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

    const r = request({
      url: `http://${req.params.source}`,
      timeout: config.timeout
    });
    r.on('response', response => {
      if (res.statusCode !== 200 && res.statusCode !== 304) {
        return stream.emit('error', createError(400, `${response.statusCode} response from ${req.params.source}`));
      }
      r.pipe(stream);
    });
    r.on('error', error => stream.emit('error', error));
  };

  /**
   * Validation
   */
  router.use((req,res, next) => {
    if (config.userAgent && req.headers['user-agent'] !== config.userAgent) {
      return next(createError(403, 'User Agent forbidden'));
    }
    if (req.params.width > config.maxWidth || req.params.height > config.maxHeight) {
      return next(createError(400, 'Requested image too large'));
    }
    if (config.hostWhitelist.length && !micromatch.any(req.params.source, config.hostWhitelist)) {
      return next(createError(400, 'Invalid remote url'));
    }
    if (config.hostBlacklist.length && micromatch.any(req.params.source, config.hostBlacklist)) {
      return next(createError(400, 'Invalid remote url'));
    }

    next();
  });

  /**
   * Recipes
   */
  router.get('/proxy/:source(*)', fetchSource);
  router.get('/resize/:width/:height/:source(*)', fetchSource, (req, res, next) => {
    req.wrender.recipe.resize(parseInt(req.params.width, 10), parseInt(req.params.height, 10));
    req.wrender.recipe.ignoreAspectRatio();
    next();
  });
  router.get('/resizex/:width/:source(*)', fetchSource, (req, res, next) => {
    req.wrender.recipe.resize(parseInt(req.params.width, 10));
    next();
  });
  router.get('/resizey/:height/:source(*)', fetchSource, (req, res, next) => {
    req.wrender.recipe.resize(null, parseInt(req.params.height, 10));
    next();
  });
  router.get('/crop/:width/:height/:source(*)', fetchSource, (req, res, next) => {
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
    if (!req.wrender) return next(createError(404));

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
  router.use((error, req, res, next) => {
    if (req.wrender && req.wrender.source) {
      fs.unlink(req.wrender.source.path);
    }

    res
      .status(error.status || 500)
      .set({
        'Content-Type': 'image/png',
        'Content-Length': blank.length,
        'X-Wrender-Error': error.message
      })
      .send(blank);
  });

  return router;
};
