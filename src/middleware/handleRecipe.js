const fs = require('fs');
const sharp = require('sharp');
const imageType = require('image-type');
const readChunk = require('read-chunk');
const errors = require('../lib/errors');

module.exports = function handleProcessing(config, recipe) {
  return (req, res, next) => {
    const type = imageType(readChunk.sync(req.tempfile, 0, 12)); // First 12 bytes contains the mime type header
    if (!type) return next(errors({ message: `Source file is not an image: ${req.originalUrl}`, status: 404 }));

    const source = fs.createReadStream(req.tempfile);
    source.on('error', err => next(err));

    const image = sharp();
    image.on('error', err => next(err));
    image.on('finish', () => fs.unlink(req.tempfile, () => {})); // eslint-disable-line no-empty-function

    const params = Object.assign({}, {
      mimetype: type.mime,
      quality: config.quality,
      includeEXIF: config.includeEXIF,
      cacheAge: config.maxAge,
      convertToJPEG: (
        (config.convertGIF && type.mime === 'image/gif') ||
        (config.convertPNG && type.mime === 'image/png')
      ),
    }, req.params);

    // Go!
    source.pipe(image);
    recipe.pipeline(image, params, res);
  };
};
