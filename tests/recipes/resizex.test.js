const assert = require('assert');
const images = require('../images');
const size = require('image-size');

describe('wrender', () => {
  describe('recipes', () => {
    describe('crop', () => {
      const recipe = require('../../recipes/resizex');

      it('should have the correct path', () => assert.equal(recipe.path, '/resizex/:width/:source'));

      it('should crop an image', (done) => {
        images.run({
          recipe,
          params: { width: 100 },
          source: 'carthrottle.png',
          dest: 'resizex-100.png',
        }, (err) => {
          if (err) return done(err);

          assert.deepEqual(size(images.getArtifactsPath('resizex-100.png')), { type: 'png', height: 100, width: 100 });
          done();
        });
      });
    });
  });
});