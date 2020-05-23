const debug = require('debug')('wrender:recipes');
const recipeController = require('../lib/recipe');

module.exports = recipeController.createRecipe('/crop/:width/:height/:origin', async (image, { width, height }) => {
  debug('Crop recipe', { width, height });

 const metadata = await image.metadata();

  const dw = parseInt(width, 10);
  const dh = parseInt(height, 10);

  const iw = metadata.width;
  const ih = metadata.height;

  const dTop = Math.round((ih - dh) / 2);
  const dLeft = Math.round((iw - dw) / 2);

  return image.extract({ top: dTop, left: dLeft, width: dw, height: dh });
});
