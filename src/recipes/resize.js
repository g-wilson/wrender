const debug = require('debug')('wrender:recipes');
const recipeController = require('../lib/recipe');

module.exports = recipeController.createRecipe('/resize/:width/:height/:origin', (image, { width, height }) => {
  debug('Resize recipe', { width, height });
  width = parseInt(width, 10);
  height = parseInt(height, 10);

  if (width && height) {
    image.resize(width, height);
    image.ignoreAspectRatio();
  } else {
    if (width) image.resize(width);
    if (height) image.resize(null, height);
  }
});
