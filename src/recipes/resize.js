const debug = require('debug')('wrender:recipes');
const recipeController = require('../lib/recipe');

module.exports = recipeController.createRecipe('/resize/:width/:height/:origin', (image, { width, height }) => {
  debug('Resize recipe', { width, height });

  const dw = parseInt(width, 10);
  const dh = parseInt(height, 10);

  if (width && height) {
    image.resize({ width: dw, height: dh });
  } else {
    if (width) image.resize({ width: dw });
    if (height) image.resize({ height: dh });
  }

  return image;
});
