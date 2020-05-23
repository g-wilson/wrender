const axios = require('axios');
const debug = require('debug')('wrender:origins');
const errors = require('../lib/errors');
const micromatch = require('micromatch');
const originController = require('../lib/origin');
const url = require('url');

module.exports = function httpOrigin(opts) {
  if (typeof opts === 'string') opts = { prefix: opts };
  opts = opts || {};

  const req = opts.defaults ? axios.create(opts.defaults) : axios;

  return originController.createOrigin(`${opts.prefix || ''}/:source(*)`, ({ source }) => Promise.resolve()
    .then(async function request(i = 0) {
      // Mimic the maxRedirects option in Axios, and return an error if it's hit
      if (opts.maxRedirects && i >= opts.maxRedirects) {
        throw errors({
          err: new Error('Too many redirects'),
          code: 'HTTP_MAX_REDIRECTED',
          status: 429,
        });
      }

      if (Array.isArray(opts.whitelist) || Array.isArray(opts.blacklist)) {
        const { whitelist, blacklist } = opts;
        const { hostname } = url.parse(source);

        // If we have a whitelist, and the hostname isn't within, or we have a blacklist and the hostname is within
        const isBlacklisted = (Array.isArray(whitelist) && whitelist.length && !micromatch.any(hostname, whitelist)) ||
          (Array.isArray(blacklist) && blacklist.length && micromatch.any(hostname, blacklist));
        if (isBlacklisted) {
          throw errors({
            err: new Error(`${source} is not a valid remote URL`),
            code: 'HTTP_BLACKLISTED_URL',
            status: 422,
          });
        }
      }

      debug(`HTTP GET: ${source}`);

      try {
        const { status, statusText, headers, data } = await req.get(source, {
          // Force no redirects, so we can check if the source is blacklisted/whitelisted ourselves
          maxRedirects: 0,
          // Always force a stream response
          responseType: 'stream',
          // Only allow an OK status or a redirect status
          validateStatus: s => s === 200 || (s > 300 && s < 400),
        });

        if (status === 200) {
          debug(`HTTP GET: ${source}: ${status} ${statusText}`, headers);
          return data;
        } else {
          const { location } = headers;
          debug(`HTTP GET: ${source}: ${status} ${statusText} ${location}`);
          source = location;
          return request(i + 1);
        }
      } catch (err) {
        if (err.response) {
          const { status, statusText } = err.response || { status: 500, statusText: 'Internal Server Error' };
          throw errors({
            err: new Error(`${status} ${statusText} response from ${source}`),
            status,
          });
        } else {
          throw err;
        }
      }
    }));
};
