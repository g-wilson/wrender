const assert = require('assert');
const images = require('../images');
const size = require('image-size');

describe('wrender', () => {
  describe('recipes', () => {
    describe('crop', () => {
      const recipe = require('../../src/recipes/crop');

      it('should have the correct path', () => assert.equal(recipe.path, '/crop/:width/:height/:origin'));

      it('should crop an image', (done) => {
        images.run({
          recipe,
          params: { height: 100, width: 100 },
          source: 'pokedex.jpg',
          dest: 'crop-100x100.jpg',
        }, (err) => {
          if (err) return done(err);

          assert.deepEqual(size(images.getArtifactsPath('crop-100x100.jpg')), { type: 'jpg', height: 100, width: 100 });
          done();
        });
      });
    });
  });
});
