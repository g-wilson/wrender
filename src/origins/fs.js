const debug = require('debug')('wrender:origins');
const fs = require('fs');
const path = require('path');
const originController = require('../origins');

module.exports = function fsOrigin(opts) {
  if (typeof opts === 'string') opts = { prefix: opts };
  opts = opts || {};

  return originController.createOrigin(`${opts.prefix || ''}/:source(*)`, ({ source }) => {
    debug(`FS origin: ${path.join(opts.mount || '', source)}`);
    return fs.createReadStream(path.join(opts.mount || '', source));
  });
};
