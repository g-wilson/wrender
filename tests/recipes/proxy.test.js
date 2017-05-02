const assert = require('assert');
const images = require('../images');
const size = require('image-size');

describe('wrender', () => {
  describe('recipes', () => {
    describe('crop', () => {
      const recipe = require('../../recipes/proxy');

      it('should have the correct path', () => assert.equal(recipe.path, '/proxy/:source'));

      it('should crop an image', (done) => {
        images.run({
          recipe,
          source: 'carthrottle.png',
          dest: 'proxy-1.png',
        }, (err) => {
          if (err) return done(err);

          assert.deepEqual(size(images.getArtifactsPath('proxy-1.png')), { type: 'png', height: 800, width: 800 });
          done();
        });
      });
    });
  });
});
