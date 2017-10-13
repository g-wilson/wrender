const express = require('express');

const errors = require('./errors');
const originsController = require('./origins');
const recipesController = require('./recipes');
const handleOrigin = require('./middleware/handleOrigin');
const handleRecipe = require('./middleware/handleRecipe');
const handleError = require('./middleware/handleError');

const builtinOrigins = [
  require('./origins/http'),
  require('./origins/fs'),
];

const builtinRecipes = [
  require('./recipes/crop'),
  require('./recipes/resize'),
  require('./recipes/proxy'),
];

/**
 * Main function:
 * Returns an Express router object configured to serve images based on the provided config.
 */
function wrender(config = {}) {
  config = Object.assign({
    quality: 85,
    convertGIF: true,
    convertPNG: true,
    includeEXIF: false,
    maxWidth: 3000,
    maxHeight: 3000,
    maxAge: 31536000, // ~1y
    timeout: 10000,
  }, config || {});

  let { recipes, origins } = config;

  const router = express.Router();

  // Ensure there is a list of recipes
  if (!Array.isArray(recipes)) recipes = builtinRecipes;

  // Ensure there is a list of origins
  if (!Array.isArray(origins)) origins = [ builtinOrigins[0]() ];

  // Mount each recipe
  recipes.forEach(recipe => {
    if (typeof recipe.path !== 'string' || typeof recipe.process !== 'function') {
      throw new Error('Missing path/recipe from recipe');
    }

    // Mount each origin for this recipe
    origins.forEach(origin => {
      if (typeof origin.path !== 'string' || typeof origin.fetch !== 'function') {
        throw new Error('Missing path/source from origin');
      }

      router.get(recipe.path.replace(recipesController.regex, origin.path), [
        handleOrigin(config, origin),
        handleRecipe(config, recipe),
      ]);
    });
  });

  router.use((req, res, next) => next(errors({
    err: new Error(`Missing route: ${req.originalUrl}`),
    name: 'NotFoundError',
    status: 404,
  })));

  router.use(handleError);

  return router;
}

/**
 * Public API:
 * Used in configuration.
 */
wrender.createOrigin = originsController.createOrigin;
wrender.createRecipe = recipesController.createRecipe;
wrender.invokeRecipe = recipesController.invokeRecipe;
wrender.recipes = builtinRecipes;
wrender.origins = builtinOrigins;

module.exports = wrender;
