const express = require('express');
const fs = require('fs');

const originsController = require('./src/origins');
const recipesController = require('./src/recipes');
const handleOrigin = require('./src/handleOrigin');
const handleRecipe = require('./src/handleRecipe');

function wrender(config) {
  let { recipes, origins } = config;
  const router = express.Router();

  // Ensure there is a list of recipes
  if (!Array.isArray(recipes)) recipes = Object.keys(recipesController.recipes).map(k => recipesController.recipes[k]);
  // Ensure there is a list of origins
  if (!Array.isArray(origins)) origins = [ originsController.origins.http() ];

  recipes.forEach(recipe => {
    if (typeof recipe.path !== 'string' || typeof recipe.recipe !== 'function') {
      throw new Error('Missing path/recipe from recipe');
    }

    origins.forEach(origin => {
      if (typeof origin.path !== 'string' || typeof origin.origin !== 'function') {
        throw new Error('Missing path/source from origin');
      }

      router.get(recipe.path.replace(/\/:origin$/, origin.path), [
        handleOrigin(config, origin.origin),
        handleRecipe(config, recipe.recipe),
      ]);
    });
  });

  router.use((req, res, next) => next(new Error(`Missing route: ${req.originalUrl}`)));
  router.use(handleErrorRoute);

  return router;
}

Object.assign(wrender, recipesController, originsController);

// eslint-disable-next-line max-len
const errBlank = new Buffer('iVBORw0KGgoAAAANSUhEUgAAAAEAAAABCAYAAAAfFcSJAAAADUlEQVR42mP8/5+hHgAHggJ/PchI7wAAAABJRU5ErkJggg==', 'base64');

const errHeaders = {
  'Content-Type': 'image/png',
  'Content-Length': errBlank.length,
};
// eslint-disable-next-line no-unused-vars
function handleErrorRoute(err, req, res, next) {
  if (req.tempfile) fs.unlink(req.tempfile, () => {}); // eslint-disable-line no-empty-function
  console.error(err);
  res.status(err.status || 500).set(errHeaders).set('X-Wrender-Error', `${err}`).send(errBlank);
}

module.exports = wrender;
