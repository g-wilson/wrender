const fs = require('fs');
const sharp = require('sharp');
const imageType = require('image-type');
const readChunk = require('read-chunk');
const errors = require('../lib/errors');

module.exports = function handleProcessing(config, recipe) {
  return (req, res, next) => {
    const type = imageType(readChunk.sync(req.tempfile, 0, 12)); // First 12 bytes contains the mime type header
    if (!type) return next(errors({ message: `Source file is not an image: ${req.originalUrl}`, status: 404 }));
    let mimetype = type.mime;

    const source = fs.createReadStream(req.tempfile);
    source.on('error', err => next(err));

    const image = sharp();
    image.on('error', err => next(err));
    image.on('finish', () => fs.unlink(req.tempfile, () => {})); // eslint-disable-line no-empty-function

    // Convert to JPEG? GIFs become still-frames
    const convertToJPEG = (
      (config.convertGIF && type.mime === 'image/gif') ||
      (config.convertPNG && type.mime === 'image/png')
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
    recipe.process(image, req.params);

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
    source.pipe(image);
    image.pipe(res);
  };
};
