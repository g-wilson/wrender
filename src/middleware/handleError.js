const fs = require('fs');

const errBlank = new Buffer('iVBORw0KGgoAAAANSUhEUgAAAAEAAAABCAYAAAAfFcSJAAAADUlEQVR42mP8/5+hHgAHggJ/PchI7wAAAABJRU5ErkJggg==', 'base64');

const errHeaders = {
  'Content-Type': 'image/png',
  'Content-Length': errBlank.length,
};

// eslint-disable-next-line no-unused-vars
module.exports = errorFn => (err, req, res, next) => {
  if (req.tempfile) fs.unlink(req.tempfile, () => {}); // eslint-disable-line no-empty-function

  res.status(err.status || 500).set(errHeaders).send(errBlank);

  if (errorFn) errorFn(err);
};
