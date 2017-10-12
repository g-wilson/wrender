const fs = require('fs');
const imageType = require('image-type');
const readChunk = require('read-chunk');
const sharp = require('sharp');

module.exports = function handleProcessing(config, recipe) {
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
