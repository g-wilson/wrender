const assert = require('assert');

describe('wrender', () => {
  const index = require('../index');

  describe('index.js', () => {
    it('should export a function with a single argument', () => {
      assert.equal(typeof index, 'function', 'Expected a function to be exported');
      assert.equal(index.length, 1, 'Expected the function to have a single argument');
    });

    it('should execute without issues', () => index());
  });
});
