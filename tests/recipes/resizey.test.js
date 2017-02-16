const assert = require('assert');
const images = require('../images');
const size = require('image-size');

describe('wrender', () => {
  describe('recipes', () => {
    describe('crop', () => {
      const recipe = require('../../recipes/resizey');

      it('should have the correct path', () => assert.equal(recipe.path, '/resizey/:height/:source'));

      it('should crop an image', (done) => {
        images.run({
          recipe,
          params: { height: 100 },
          source: 'carthrottle.png',
          dest: 'resizey-100.png',
        }, (err) => {
          if (err) return done(err);

          assert.deepEqual(size(images.getArtifactsPath('resizey-100.png')), { type: 'png', height: 100, width: 100 });
          done();
        });
      });
    });
  });
});
