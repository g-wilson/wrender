const debug = require('debug')('wrender:origins');
const fs = require('fs');
const micromatch = require('micromatch');
const path = require('path');
const promisify = require('./promisify');
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
        return new Origin(`${opts.prefix || ''}/:source(*)`, async ({ source }) => {
          await promisify(function makeRequest(callback) {
            if (isBlacklisted(source)) throw new Error(`${source} is not a valid remote URL`);

            debug(`HTTP HEAD: ${source}`);
            request.head(source, (err, res) => {
              if (err) {
                callback(err);
              } else if (res.statusCode >= 301 && res.statusCode <= 303 && res.headers.location) {
                source = res.headers.location;
                makeRequest(callback);
              } else if (res.statusCode !== 200 && res.statusCode !== 304) {
                callback(new Error(`${res.statusCode} response from ${source}`));
              } else {
                callback();
              }
            });
          });

          debug(`HTTP GET: ${source}`);
          return req(source);
        });
      } else {
        return new Origin(`${opts.prefix || ''}/:source(*)`, ({ source }) => {
          debug(`HTTP GET: ${source}`);
          return req(source);
        });
      }
    },
  },
};
