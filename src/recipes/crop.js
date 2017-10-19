const debug = require('debug')('wrender:recipes');
const sharp = require('sharp');
const recipeController = require('../lib/recipe');

module.exports = recipeController.createRecipe('/crop/:width/:height/:origin', (image, { width, height }) => {
  debug('Crop recipe', { width, height });
  image.resize(parseInt(width, 10), parseInt(height, 10));
  image.crop(sharp.gravity.center);
  // image.crop(sharp.strategy.entropy);
  // image.crop(sharp.strategy.attention);
});
