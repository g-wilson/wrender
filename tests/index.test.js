const assert = require('assert');
const images = require('./images');
const superagent = require('supertest');
const url = require('url')

describe('wrender', () => {
  const wrender = require('../index');
  let fport;
  let fserver;

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
    it('should export a function with a single argument', () => {
      assert.equal(typeof wrender, 'function', 'Expected a function to be exported');
      assert.equal(wrender.length, 1, 'Expected the function to have a single argument');
    });

    it('should execute without issues', () => wrender());

    it('should return an image correctly', done => {
      superagent(images.createExpressApp(wrender()))
        .get(`/proxy/localhost:${fport}/carthrottle.png`)
        .expect(200)
        .expect(images.assertHeaders)
        .end(done);
    });
  });
});
