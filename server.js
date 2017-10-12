const express = require('express');
const request = require('request');
const util = require('util');
const wrender = require('./index');

const app = express();
app.get('/favicon.ico', (req, res) => res.sendStatus(204));
app.use(require('morgan')('tiny'));

app.use(wrender({
  recipes: Object.keys(wrender.recipes).map(k => wrender.recipes[k]).concat([
    wrender.createRecipe('/mirror/:origin', image => {
      wrender.invokeRecipe(wrender.recipes.resize, image, { width: 200, height: 200 });
      image.flop();
    }),
  ]),
  origins: [
    wrender.createOrigin('/fb/:profile_id', ({ profile_id }) => request({
      url: util.format('https://graph.facebook.com/%d/picture', profile_id),
      qs: { width: 1024, height: 1024 },
    })),
    wrender.origins.fs('/fs'),
    wrender.origins.http(),
  ],
}));

// eslint-disable-next-line no-console
app.listen(3010, 'localhost', () => console.log('Server started on port 3010 😎'));
