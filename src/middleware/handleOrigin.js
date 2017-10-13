const fs = require('fs');
const temp = require('temp');

module.exports = function handleSource(config, origin) {
  if (config.userAgent || Array.isArray(config.userAgent)) config.userAgent = [ config.userAgent ];

  const tempOpts = {};
  if (config.tmpdir) tempOpts.dir = config.tmpdir;

  return (req, res, next) => {
    if (config.userAgent && config.userAgent.indexOf(req.get('user-agent')) < 0) {
      return next(new Error('User Agent forbidden'));
    }

    if (config.maxWidth || config.maxHeight) {
      if (req.params.width > config.maxWidth || req.params.height > config.maxHeight) {
        return next(new Error('Requested image too large'));
      }
    }

    // Attach a temp path to the req
    req.tempfile = temp.path(tempOpts);

    // Create a write stream to a temp path
    const stream = fs.createWriteStream(req.tempfile);
    stream.on('error', err => next(err));
    stream.on('finish', () => next());

    // origin.fetch could be sync or return a promise - we can handle both
    Promise.resolve()
      .then(async () => {
        const source = await origin.fetch(req.params);
        source.on('error', err => stream.emit('error', err));
        source.pipe(stream);
      })
      .catch(err => stream.emit('error', err));
  };
};
