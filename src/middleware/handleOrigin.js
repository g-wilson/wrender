const assert = require('http-assert');
const fs = require('fs');
const temp = require('temp');

module.exports = function handleSource(config, origin) {
  return (req, res, next) => {
    const { userAgent } = config;
    assert(!userAgent || userAgent.includes(req.get('user-agent')), 403, new Error('User-Agent forbidden'));

    const { maxHeight, maxWidth } = config;
    const { height, width } = req.params;
    assert((!maxHeight && !maxWidth) || ((height || 0) <= maxHeight && (width || 0) <= maxWidth),
      400, new Error(`Requested image size is too large, should be no more than ${maxWidth}x${maxHeight}`));

    // Attach a temp path to the req
    req.tempfile = temp.path({ dir: config.tmpdir });

    // Create a write stream to a temp path
    const stream = fs.createWriteStream(req.tempfile);
    stream.on('error', err => next(err));
    stream.on('finish', () => next());

    // origin.fetch could be sync or return a promise - we can handle both
    Promise.resolve()
      .then(async () => {
        const source = await origin.fetch(Object.assign(req.params, {
          query: req.query,
          path: req.path,
          originalUrl: req.originalUrl,
        }));
        source.on('error', err => stream.emit('error', err));
        source.pipe(stream);
      })
      .catch(err => stream.emit('error', err));
  };
};
