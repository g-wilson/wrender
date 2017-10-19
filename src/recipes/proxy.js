const debug = require('debug')('wrender:recipes');
const recipeController = require('../lib/recipe');

module.exports = recipeController.createRecipe('/proxy/:origin', () => {
  debug('Proxy recipe');
});
