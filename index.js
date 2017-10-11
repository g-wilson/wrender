const express = require('express');
const fs = require('fs');
const imageType = require('image-type');
const path = require('path');
const readChunk = require('read-chunk');
const sharp = require('sharp');
const temp = require('temp');

const originsController = require('./src/origins');
const recipesController = require('./src/recipes');

function wrender(config) {
  let { recipes, origins } = config;
  const router = express.Router();

  // Ensure there is a list of recipes
  if (!Array.isArray(recipes)) recipes = [ recipesController.recipes.proxy, recipesController.recipes.resize ];
  // Ensure there is a list of origins
  if (!Array.isArray(origins)) origins = [ originsController.origins.http() ];

  recipes.forEach(recipe => {
    if (typeof recipe.path !== 'string' || typeof recipe.recipe !== 'function') {
      throw new Error('Missing path/recipe from recipe');
    }

    origins.forEach(origin => {
      if (typeof origin.path !== 'string' || typeof origin.origin !== 'function') {
        throw new Error('Missing path/source from origin');
      }

      router.get(path.posix.join(recipe.path.replace(/:origin$/, ''), origin.path), [
        handleSource(config, origin.origin),
        handleProcessing(config, recipe.recipe),
      ]);
    });
  });

  router.use((req, res, next) => next(new Error(`Missing route: ${req.originalUrl}`)));
  router.use(handleErrorRoute);

  return router;
}

Object.assign(wrender, recipesController, originsController);

function handleSource(config, origin) {
  return (req, res, next) => {
    req.tempfile = temp.path();

    // Create a write stream to a temp path
    const stream = fs.createWriteStream(req.tempfile);
    stream.on('error', err => next(err));
    stream.on('finish', () => next());

    // Recursively fetch the image from the origin, pipe it to our temp file.
    const r = origin(req.params);
    r.on('error', err => stream.emit('error', err));
    r.pipe(stream);
  };
}

function handleProcessing(config, recipe) {
  return (req, res, next) => {
    const type = imageType(readChunk.sync(req.tempfile, 0, 12)); // First 12 bytes contains the mime type header
    if (!type) return next(new Error(`Source file is not an image: ${req.originalUrl}`));

    const source = fs.createReadStream(req.tempfile);
    source.on('error', err => next(err));

    // If we are not converting GIFs we must direct proxy the image. Sharp cannot process (animated) GIFs.
    // if (!config.convertGIF && mimetype === 'image/gif') return next();

    const image = sharp();
    image.on('error', err => next(err));
    image.on('finish', () => fs.unlink(req.tempfile, () => {})); // eslint-disable-line no-empty-function

    const mimetype = (({ mime }) => {
      // Convert to JPEG? GIFs become still-frames
      if (mime !== 'image/jpeg') {
        const convertToJPEG = (
          (config.convertGIF && mime === 'image/gif') ||
          (config.convertPNG && mime === 'image/png')
        );

        if (convertToJPEG) {
          image.background({ r: 0, g: 0, b: 0, alpha: 0 });
          image.flatten();
          image.toFormat(sharp.format.jpeg);
          mime = 'image/jpeg';
        }
      }

      // Respect EXIF orientation headers
      if (mime === 'image/jpeg') {
        image.rotate();
      }

      return mime;
    })(type);

    res.set('Content-Type', mimetype);
    res.set('Cache-Control', `public, max-age=${config.maxAge}`);

    recipe(image, req.params);

    // Always apply compression at the end
    if (mimetype === 'image/jpeg') {
      image.jpeg({ quality: config.quality || 85 });
    }

    // Discard EXIF
    if (config.includeEXIF === true) {
      image.withMetadata();
    }

    // Go!
    source.pipe(image);
    image.pipe(res);
  };
}

// eslint-disable-next-line max-len
const errBlank = new Buffer('iVBORw0KGgoAAAANSUhEUgAAAAEAAAABCAYAAAAfFcSJAAAADUlEQVR42mP8/5+hHgAHggJ/PchI7wAAAABJRU5ErkJggg==', 'base64');

const errHeaders = {
  'Content-Type': 'image/png',
  'Content-Length': errBlank.length,
};
// eslint-disable-next-line no-unused-vars
function handleErrorRoute(err, req, res, next) {
  if (req.tempfile) fs.unlink(req.tempfile, () => {}); // eslint-disable-line no-empty-function
  // console.error(err);
  res.status(err.status || 500).set(errHeaders).set('X-Wrender-Error', `${err}`).send(errBlank);
}

module.exports = wrender;
