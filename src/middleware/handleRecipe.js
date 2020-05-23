const assert = require('http-assert');
const fs = require('fs');
const sharp = require('sharp');
const imageType = require('image-type');
const readChunk = require('read-chunk');

module.exports = function handleProcessing(defaultConfig, recipe) {

  // Allows recipes to define overwrite the wrender instance config
  const config = Object.freeze(Object.assign({}, defaultConfig, recipe.config));

  return (req, res, next) => {
    let { mime: mimetype } = imageType(readChunk.sync(req.tempfile, 0, 12)); // First 12 bytes contains the mimetype
    assert(`${mimetype}`.startsWith('image/'), 404, new Error(`Source file is not an image: ${req.originalUrl}`));

    const source = fs.createReadStream(req.tempfile);
    const image = sharp();

    source.on('error', err => next(err));
    image.on('error', err => source.emit('error', err));
    image.on('finish', () => fs.unlink(req.tempfile, () => {})); // eslint-disable-line no-empty-function

    // Convert to JPEG? GIFs become still-frames
    const convertToJPEG = (
      (config.convertGIF && mimetype === 'image/gif') ||
      (config.convertPNG && mimetype === 'image/png')
    );
    if (mimetype !== 'image/jpeg' && convertToJPEG) {
      mimetype = 'image/jpeg';
      image.background({ r: 0, g: 0, b: 0, alpha: 0 });
      image.flatten();
      image.toFormat(sharp.format.jpeg);
    }

    // Respect EXIF orientation headers
    if (mimetype === 'image/jpeg') {
      image.rotate();
    }

    // Apply recipe
    recipe.process(image, Object.freeze(Object.assign({}, req.params, {
      query: req.query,
      path: req.path,
      originalUrl: req.originalUrl,
    })));

    // Always apply compression at the end
    if (mimetype === 'image/jpeg') {
      image.jpeg({ quality: config.quality || 85 });
    }

    // Discard EXIF
    if (config.includeEXIF === true) {
      image.withMetadata();
    }

    res.set('Cache-Control', `public, max-age=${config.maxAge}`);
    res.set('Content-Type', mimetype);

    // Go!
    image.pipe(res);
    source.pipe(image);
  };
};
