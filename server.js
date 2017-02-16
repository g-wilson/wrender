const express = require('express');
const app = express();
const wrender = require('./index');

app.get('/favicon.ico', (req, res) => res.sendStatus(204));

app.use(wrender({
  recipes: [
    wrender.recipes.proxy,
    wrender.recipes.resizex,

    {
      path: '/thumbnail/:source',
      recipe: wrender.invoke(wrender.recipes.resizex, { width: 150 }),
    },

    {
      path: '/rotate/:angle/:source',
      recipe(image, params) {
        image.rotate(parseInt(params.angle, 10));
      },
    },

    {
      path: '/rotateasync/:angle/:source',
      recipe(image, params, next) {
        image.rotate(parseInt(params.angle, 10));
        next();
      },
    },

  ],
}));

app.listen(3010, 'localhost', () => console.log('Server started on port 3010 😎'));
