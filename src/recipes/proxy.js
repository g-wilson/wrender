const debug = require('debug')('wrender:recipes');
const recipeController = require('../recipes');

module.exports = recipeController.createRecipe('/proxy/:origin', () => {
  debug('Proxy recipe');
});
