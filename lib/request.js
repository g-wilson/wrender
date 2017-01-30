const errors = require('./errors');
const micromatch = require('micromatch');
const request = require('request');
const url = require('url');

module.exports = function (config) {
  config = config || {};

  const isBlacklisted = createBlacklistFn(config.hostBlacklist, config.hostWhitelist);

  function makeRequest(source, resolve, reject) {
    if (isBlacklisted(source)) {
      return reject(errors.ArgumentError('INVALID_REMOTE_URL', `${source} is not a valid remote URL`));
    }

    const r = request({
      url: source,
      followRedirect: false,
      timeout: config.timeout,
    });

    r.on('error', reject);
    r.on('response', res => {
      if (res.statusCode >= 301 && res.statusCode <= 303 && res.headers.location) {
        makeRequest(res.headers.location, resolve, reject);
      }
      else if (res.statusCode !== 200 && res.statusCode !== 304) {
        reject(errors.ArgumentError('INVALID_SOURCE_RES', `${res.statusCode} response from ${source}`));
      }
      else {
        resolve(r);
      }
    });
  }

  return {
    get(source) {
      return new Promise((resolve, reject) => makeRequest(`http://${source}`, resolve, reject));
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
