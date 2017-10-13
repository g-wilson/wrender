const debug = require('debug')('wrender:origins');
const micromatch = require('micromatch');
const request = require('request');
const url = require('url');
const promisify = require('../promisify');
const originController = require('../lib/origin');

module.exports = function httpOrigin(opts) {
  if (typeof opts === 'string') opts = { prefix: opts };
  opts = opts || {};

  const req = opts.defaults ? request.defaults(opts.defaults) : request;

  const filterable = (Array.isArray(opts.whitelist) && opts.whitelist.length) ||
    (Array.isArray(opts.blacklist) && opts.blacklist.length);

  if (!filterable) {
    return originController.createOrigin(`${opts.prefix || ''}/:source(*)`, ({ source }) => {
      debug(`HTTP GET: ${source}`);
      return req(source);
    });
  }

  return originController.createOrigin(`${opts.prefix || ''}/:source(*)`, async ({ source }) => {
    await promisify(function makeRequest(callback) {
      let isBlacklisted = false;

      if (Array.isArray(opts.whitelist) && opts.whitelist.length) {
        if (!micromatch.any(url.parse(source).hostname, opts.whitelist)) isBlacklisted = true;
      }
      if (Array.isArray(opts.blacklist) && opts.blacklist.length) {
        if (micromatch.any(url.parse(source).hostname, opts.blacklist)) isBlacklisted = true;
      }

      if (isBlacklisted) return Promise.reject(new Error(`${source} is not a valid remote URL`));

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
};
