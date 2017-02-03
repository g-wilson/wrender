/**
 *
 */
const fs = require('fs');
const path = require('path');
const recipes = module.exports = {};

fs.readdirSync(__dirname).sort().forEach(function (file) {
  if (file === 'index.js' || path.extname(file) !== '.js') return;

  Object.defineProperty(recipes, path.basename(file, path.extname(file)), {
    enumerable: true,
    value: require(path.join(__dirname, file)),
  });
});

// Attach an array of all our defaults
recipes.defaults = Object.keys(recipes).map(r => recipes[r]);
