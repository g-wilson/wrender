const ORIGIN_REGEX = /\/:origin$/;

class Recipe {

  constructor (recipePath, processFn) {
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
  }

}

module.exports = {

  createRecipe: (recipePath, processFn) => new Recipe(recipePath, processFn),

  invokeRecipe(recipe, image, params) {
    if (!(recipe instanceof Recipe)) throw new Error('Expected recipe to be an instance of Recipe');
    recipe.recipe(image, params);
  },

  instanceofRecipe: input => input instanceof Recipe,

  regex: ORIGIN_REGEX,

};
