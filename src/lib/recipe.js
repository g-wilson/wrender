const ORIGIN_REGEX = /\/:origin$/;

class WrenderRecipe {

  constructor (recipePath, processFn, config = {}) {
    if (typeof recipePath !== 'string') {
      throw new Error('Expected path to be a string');
    }
    if (typeof processFn !== 'function') {
      throw new Error('Expected recipe to be a function');
    }
    if (!ORIGIN_REGEX.test(recipePath)) {
      throw new Error(`Expected recipe path "${recipePath}" to end with "/:origin"`);
    }

    Object.defineProperty(this, 'path', { enumerable: true, value: recipePath });
    Object.defineProperty(this, 'process', { enumerable: true, value: processFn });
    Object.defineProperty(this, 'config', { enumerable: true, value: Object.freeze(config) });
  }

}

module.exports = {

  createRecipe: (recipePath, processFn, config) => new WrenderRecipe(recipePath, processFn, config),

  invokeRecipe(recipe, image, params) {
    if (!(recipe instanceof WrenderRecipe)) throw new Error('Expected recipe to be an instance of Recipe');
    recipe.process(image, params);
  },

  instanceofRecipe: input => input instanceof WrenderRecipe,

  regex: ORIGIN_REGEX,

};
