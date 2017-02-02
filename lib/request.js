const errors = require('./errors');
const micromatch = require('micromatch');
const request = require('request');
const url = require('url');
const temp = require('temp').track();

module.exports = function (config) {
  config = config || {};

  const isBlacklisted = createBlacklistFn(config.hostBlacklist, config.hostWhitelist);

  function makeRequest(opts, stream) {
    if (typeof opts === 'string') opts = { url: opts };
    if (opts.url.indexOf('http') !== 0) opts.url = `http://${opts.url}`;

    opts.followRedirect = false;
    opts.timeout = config.timeout;

    if (isBlacklisted(opts.url)) {
      return stream.emit('error', errors.ArgumentError('INVALID_REMOTE_URL', `${opts.url} is not a valid remote URL`));
    }

    const r = request(opts);

    r.on('error', err => {
      stream.emit('error', err);
    });
    r.on('response', res => {
      if (res.statusCode >= 301 && res.statusCode <= 303 && res.headers.location) {
        return makeRequest(res.headers.location, stream);
      }
      else if (res.statusCode !== 200 && res.statusCode !== 304) {
        return stream.emit('error', errors.ArgumentError('INVALID_SOURCE_RES', `${res.statusCode} response from ${opts.url}`));
      }

      r.pipe(stream);
    });
  }

  return {
    fetchSourceMiddleware(req, res, next) {

      // Temporary file (as a readable stream) representing the source image
      const stream = temp.createWriteStream();
      stream.on('error', next);

      // When the source is downloaded to temp stream, we can kickstart the processing
      stream.on('finish', () => {
        req.wrender.temp = stream;
        next();
      });

      // Recursively fetch the source image, pipe it to our temp file.
      makeRequest(req.wrender.requestOpts, stream);
    },
    isBlacklisted,
  };
};

function createBlacklistFn(blacklist, whitelist) {
  if (Array.isArray(whitelist) && whitelist.length) {
    return source => !micromatch.any(url.parse(source).hostname, whitelist);
  }
  else if (Array.isArray(blacklist) && blacklist.length) {
    return source => micromatch.any(url.parse(source).hostname, blacklist);
  }
  else {
    return () => false;
  }
}
