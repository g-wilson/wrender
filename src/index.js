const debug = require('debug')('wrender:server');
const express = require('express');
const errors = require('./lib/errors');
const originsController = require('./lib/origin');
const recipesController = require('./lib/recipe');
const handleOrigin = require('./middleware/handleOrigin');
const handleRecipe = require('./middleware/handleRecipe');
const handleError = require('./middleware/handleError');

const builtinOrigins = {
  http: require('./origins/http'),
  fs: require('./origins/fs'),
  identicon: require('./origins/identicon'),
  initials: require('./origins/initials'),
};

const builtinRecipes = {
  crop: require('./recipes/crop'),
  resize: require('./recipes/resize'),
  proxy: require('./recipes/proxy'),
};

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

  if (config.userAgent && !Array.isArray(config.userAgent)) config.userAgent = [ config.userAgent ];

  let { recipes, origins } = config;

  const router = express.Router();

  // Ensure there is a list of recipes
  if (!Array.isArray(recipes)) recipes = Object.values(builtinRecipes);

  // Ensure there is a list of origins
  if (!Array.isArray(origins)) origins = [ builtinOrigins.http() ];

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

      const mountPath = recipe.path.replace(recipesController.regex, origin.path);

      debug(`Adding route ${mountPath}`);

      router.get(mountPath, [
        handleOrigin(Object.assign({}, config), origin),
        handleRecipe(Object.assign({}, config), recipe),
      ]);
    });
  });

  router.use((req, res, next) => next(errors({
    err: new Error(`Missing route: ${req.originalUrl}`),
    name: 'NotFoundError',
    status: 404,
  })));

  router.use(handleError(config.onError));

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
