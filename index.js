const fs = require('fs');
const express = require('express');
const temp = require('temp').track();
const readChunk = require('read-chunk');
const imageType = require('image-type');
const sharp = require('sharp');
const micromatch = require('micromatch');

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
    hostWhitelist: [],
    hostBlacklist: [],
  }, config || {});

  const request = configureRequests(config);
  const router = express.Router();

  /**
   * Source handler
   */
  const fetchSource = (req, res, next) => {
    const stream = temp.createWriteStream();
    stream.on('error', next);
    stream.on('finish', () => {
      const type = imageType(readChunk.sync(stream.path, 0, 12)); // First 12 bytes contains the mime type header
      if (!type) return next(errors.ArgumentError('INVALID_IMG', `Source file is not an image: ${req.originalUrl}`));

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

    request(req.params.source)
      .then(r => r.pipe(stream))
      .catch(err => stream.emit('error', err));
  };

  /**
   * Validation
   */
  router.use((req,res, next) => {
    if (config.userAgent && req.headers['user-agent'] !== config.userAgent) {
      return next(errors.AccessForbidden('USER_AGENT_FORBIDDEN', 'Invalid user agent'));
    }

    if (req.params.width > config.maxWidth || req.params.height > config.maxHeight) {
      return next(errors.ArgumentError('IMG_TOO_LARGE', 'Requested image is too large'));
    }

    // isBlacklisted looks at the whitelist, then the blacklist, and makes a decision
    if (request.isBlacklisted(`http://${req.params.source}`)) {
      return next(errors.ArgumentError('INVALID_REMOTE_URL', `${req.params.source} is not a valid remote URL`));
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
  router.use((error, req, res) => {
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
