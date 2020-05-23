const debug = require('debug')('wrender:recipes');
const recipeController = require('../lib/recipe');

module.exports = recipeController.createRecipe('/proxy/:origin', image => {
  debug('Proxy recipe');
  return image;
});
