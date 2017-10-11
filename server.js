const wrender = require('./index');

const app = require('express')();
app.get('/favicon.ico', (req, res) => res.sendStatus(204));
app.use(require('morgan')('tiny'));

app.use(wrender({
  origins: [
    wrender.origins.fs(),
  ],
}));

// eslint-disable-next-line no-console
app.listen(3010, 'localhost', () => console.log('Server started on port 3010 😎'));
