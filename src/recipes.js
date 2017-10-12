const debug = require('debug')('wrender:recipes');
const sharp = require('sharp');

const ORIGIN_REGEX = /\/:origin$/;

function Recipe(recipePath, recipeFn) {
  if (typeof recipePath !== 'string') {
    throw new Error('Expected path to be a string');
  }
  if (typeof recipeFn !== 'function') {
    throw new Error('Expected recipe to be a function');
  }
  if (!ORIGIN_REGEX.test(recipePath)) {
    throw new Error(`Expected recipe path "${recipePath}" to end with "/:origin"`);
  }

  Object.defineProperty(this, 'path', { enumerable: true, value: recipePath });
  Object.defineProperty(this, 'recipe', { enumerable: true, value: recipeFn });
}

module.exports = {
  createRecipe: (recipePath, recipeFn) => new Recipe(recipePath, recipeFn),

  invokeRecipe(recipe, image, params) {
    if (!(recipe instanceof Recipe)) throw new Error('Expected recipe to be an instance of Recipe');
    recipe.recipe(image, params);
  },

  instanceofRecipe: input => input instanceof Recipe,

  recipes: {
    proxy: new Recipe('/proxy/:origin', () => {
      debug('Proxy recipe');
    }),
    resize: new Recipe('/resize/:width/:height/:origin', (image, { width, height }) => {
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
    }),
    crop: new Recipe('/crop/:width/:height/:origin', (image, { width, height }) => {
      debug('Crop recipe', { width, height });
      image.resize(parseInt(width, 10), parseInt(height, 10));
      image.crop(sharp.gravity.center);
      // image.crop(sharp.strategy.entropy);
      // image.crop(sharp.strategy.attention);
    }),
  },
};
