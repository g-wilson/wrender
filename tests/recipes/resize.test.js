const assert = require('assert');
const images = require('../images');
const size = require('image-size');

describe('wrender', () => {
  describe('recipes', () => {
    describe('crop', () => {
      const recipe = require('../../recipes/resize');

      it('should have the correct path', () => assert.equal(recipe.path, '/resize/:width/:height/:source'));

      it('should crop an image', (done) => {
        images.run({
          recipe,
          params: { height: 200, width: 100 },
          source: 'carthrottle.png',
          dest: 'resize-200-100.png',
        }, (err) => {
          if (err) return done(err);

          assert.deepEqual(size(images.getArtifactsPath('resize-200-100.png')), { type: 'png', height: 200, width: 100 });
          done();
        });
      });
    });
  });
});
