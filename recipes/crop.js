const sharp = require('sharp');

module.exports = {
  path: '/crop/:width/:height/:source',
  recipe(image, params) {
    image.resize(parseInt(params.width, 10), parseInt(params.height, 10));
    image.crop(sharp.gravity.center);
    // image.crop(sharp.strategy.entropy);
    // image.crop(sharp.strategy.attention);
  }
};
