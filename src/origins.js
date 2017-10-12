const debug = require('debug')('wrender:origins');
const fs = require('fs');
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

  instanceofOrigin: input => input instanceof Origin,

  origins: {
    fs: opts => {
      if (typeof opts === 'string') opts = { prefix: opts };
      opts = opts || {};

      return new Origin(`${opts.prefix || ''}/:source(*)`, ({ source }) => {
        debug(`FS origin: ${opts.mount || ''}/${source}`);
        return fs.createReadStream(`${opts.mount || ''}/${source}`);
      });
    },
    http: opts => {
      if (typeof opts === 'string') opts = { prefix: opts };
      opts = opts || {};

      const req = opts.defaults ? request.defaults(opts.defaults) : request;

      return new Origin(`${opts.prefix || ''}/:source(*)`, ({ source }) => {
        debug(`HTTP origin: ${source}`);
        return req(source);
      });
    },
  },
};
