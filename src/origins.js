const fs = require('fs');
const micromatch = require('micromatch');
const request = require('request');
const url = require('url');

function Origin(path, origin) {
  if (typeof path !== 'string') {
    throw new Error('Expected path to be a string');
  }
  if (typeof origin !== 'function') {
    throw new Error('Expected origin to be a function');
  }

  Object.defineProperty(this, 'path', { enumerable: true, value: path });
  Object.defineProperty(this, 'origin', { enumerable: true, value: origin });
}

module.exports = {
  createOrigin: (path, origin) => new Origin(path, origin),

  cloneOrigin(origin) {
    if (!(origin instanceof Origin)) throw new Error('Expected origin to be an instance of Origin');
    return origin.origin;
  },

  origins: {
    fs: opts => {
      if (typeof opts === 'string') opts = { prefix: opts };
      opts = opts || {};

      return new Origin(`${opts.prefix || ''}/:source(*)`, ({ source }) =>
        fs.createReadStream(`${opts.mount || ''}/${source}`));
    },
    http: opts => {
      if (typeof opts === 'string') opts = { prefix: opts };
      opts = opts || {};

      const isBlacklist = (({ whitelist, blacklist }) => {
        if (Array.isArray(whitelist) && whitelist.length) {
          return hostname => !micromatch.any(hostname, whitelist);
        }
        else if (Array.isArray(blacklist) && blacklist.length) {
          return hostname => micromatch.any(hostname, blacklist);
        }
        else {
          return () => false;
        }
      })(opts);

      return new Origin(`${opts.prefix || ''}/:source(*)`, ({ source }) => {
        if (isBlacklist(url.parse(source).hostname)) throw new Error(`${source} is not a valid remote URL`);
        return request(source);
      });
    },
  },
};
