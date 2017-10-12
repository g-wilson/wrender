const debug = require('debug')('wrender:origins');
const fs = require('fs');
const micromatch = require('micromatch');
const path = require('path');
const request = require('request');
const url = require('url');

function Origin(originPath, originFn) {
  if (typeof originPath !== 'string') {
    throw new Error('Expected path to be a string');
  }
  if (typeof originFn !== 'function') {
    throw new Error('Expected origin to be a function');
  }

  Object.defineProperty(this, 'path', { enumerable: true, value: originPath });
  Object.defineProperty(this, 'origin', { enumerable: true, value: originFn });
}

module.exports = {
  createOrigin: (originPath, originFn) => new Origin(originPath, originFn),

  instanceofOrigin: input => input instanceof Origin,

  origins: {
    fs: opts => {
      if (typeof opts === 'string') opts = { prefix: opts };
      opts = opts || {};

      return new Origin(`${opts.prefix || ''}/:source(*)`, ({ source }) => {
        debug(`FS origin: ${path.join(opts.mount || '', source)}`);
        return fs.createReadStream(path.join(opts.mount || '', source));
      });
    },
    http: opts => {
      if (typeof opts === 'string') opts = { prefix: opts };
      opts = opts || {};

      const req = opts.defaults ? request.defaults(opts.defaults) : request;

      const isBlacklisted = (({ whitelist, blacklist }) => {
        if (Array.isArray(whitelist) && whitelist.length) {
          return source => !micromatch.any(url.parse(source).hostname, whitelist);
        }
        else if (Array.isArray(blacklist) && blacklist.length) {
          return source => micromatch.any(url.parse(source).hostname, blacklist);
        }
        else {
          return false;
        }
      })(opts);

      if (isBlacklisted) {
        return new Origin(`${opts.prefix || ''}/:source(*)`, function makeRequest({ source }, callback) {
          if (isBlacklisted(source)) return callback(new Error(`${source} is not a valid remote URL`));

          const stream = req(source);
          stream.on('response', res => {
            if (res.statusCode >= 301 && res.statusCode <= 303 && res.headers.location) {
              makeRequest({ source: res.headers.location }, callback);
            } else if (res.statusCode !== 200 && res.statusCode !== 304) {
              callback(new Error(`${res.statusCode} response from ${source}`));
            } else {
              callback(null, stream);
            }
          });
        });
      } else {
        return new Origin(`${opts.prefix || ''}/:source(*)`, ({ source }) => {
          debug(`HTTP origin: ${source}`);
          return req(source);
        });
      }
    },
  },
};
