const assert = require('assert');
const images = require('./images');
const superagent = require('supertest');
const url = require('url');

describe('wrender', () => {
  const wrender = require('../src');
  let fport;
  let fserver

  function createServer(route) {
    const app = express();
  }

  before(callback => {
    images.staticFixturesServer(({ port, server }) => {
      fport = port;
      fserver = server;
      callback();
    });
  });

  after(() => fserver.close());

  describe('index.js', () => {

    it('should export a function', () => {
      assert.equal(typeof wrender, 'function', 'Expected a function to be exported');
    });

    it('should export a public API', () => {
      assert(wrender.createOrigin);
      assert(wrender.createRecipe);
      assert(wrender.invokeRecipe);
      assert(wrender.recipes);
      assert(wrender.origins);
    });

    it('should execute without issues', () => wrender());

    it('should return an image correctly', done => {
      superagent(images.createExpressApp(wrender()))
        .get(`/proxy/http://localhost:${fport}/pokedex.jpg`)
        .expect(200)
        .expect(({ headers }) => {
          assert.equal(headers['cache-control'], 'public, max-age=31536000', 'Cache-Control header must be set and 31536000');
          assert.equal(headers['content-type'], 'image/jpeg', 'Content-Type header must be set and image/jpeg');
          assert.equal(headers['transfer-encoding'], 'chunked', 'Transfer-Encoding must be set to chunked');
        })
        .end(done);
    });

    it('should return a 404 blank response if the origin image is not resolved', done => {
      superagent(images.createExpressApp(wrender()))
        .get(`/proxy/http://localhost:${fport}/foobar.jpg`)
        .expect(404)
        .end(done);
    });

    it.skip('should return a 500 blank response and error message in header if an internal error is thrown');

    it.skip('should convert GIFs to JPG if the option is specified');

    it.skip('should convert PNGs to JPG if the option is specified');

    it.skip('should preserve EXIF if the option is specified');

    it.skip('should respect the orientation EXIF header');

    it.skip('should set cache control and expiry headers');

  });

  describe('custom recipes', () => {

    it.skip('todo');

  });

  describe('custom origins', () => {

    it.skip('todo');

  });

  describe('default origins', () => {

    describe('http', () => {

      it.skip('todo');

    });

    describe('fs', () => {

      it.skip('todo');

    });

  });

});
