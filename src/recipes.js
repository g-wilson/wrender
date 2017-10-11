function Recipe(path, recipe) {
  if (typeof path !== 'string') {
    throw new Error('Expected path to be a string');
  }
  if (typeof recipe !== 'function') {
    throw new Error('Expected recipe to be a function');
  }
  if (path.indexOf(':origin') !== (path.length - ':origin'.length)) {
    throw new Error(`Expected recipe path "${path}" to end with :origin`);
  }

  Object.defineProperty(this, 'path', { enumerable: true, value: path });
  Object.defineProperty(this, 'recipe', { enumerable: true, value: recipe });
}

module.exports = {
  createRecipe: (path, recipe) => new Recipe(path, recipe),

  cloneRecipe(recipe) {
    if (!(recipe instanceof Recipe)) throw new Error('Expected recipe to be an instance of Recipe');
    return recipe.recipe;
  },

  recipes: {
    proxy: new Recipe('/proxy/:origin', () => {}), // eslint-disable-line no-empty-function
    resize: new Recipe('/resize/:origin', (image, { width, height }) => {
      if (width && height) {
        image.resize(parseInt(width, 10), parseInt(height, 10));
        image.ignoreAspectRatio();
      } else {
        if (width) image.resize(parseInt(width, 10));
        if (height) image.resize(null, parseInt(height, 10));
      }
    }),
  },
};
