const assert = require('assert');
const images = require('../images');
const size = require('image-size');

describe('wrender', () => {
  describe('recipes', () => {
    describe('crop', () => {
      const recipe = require('../../src/recipes/resize');

      it('should have the correct path', () => assert.equal(recipe.path, '/resize/:width/:height/:origin'));

      it('should resize an image', (done) => {
        images.run({
          recipe,
          params: { height: 200, width: 100 },
          source: 'pokedex.jpg',
          dest: 'resize-200-100.jpg',
        }, (err) => {
          if (err) return done(err);

          assert.deepEqual(size(images.getArtifactsPath('resize-200-100.jpg')), { type: 'jpg', height: 200, width: 100 });
          done();
        });
      });
    });
  });
});
