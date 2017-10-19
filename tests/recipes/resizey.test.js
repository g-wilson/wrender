const assert = require('assert');
const images = require('../images');
const size = require('image-size');

describe('wrender', () => {
  describe('recipes', () => {
    describe('crop', () => {
      const recipe = require('../../src/recipes/resize');

      it('should have the correct path', () => assert.equal(recipe.path, '/resize/:width/:height/:origin'));

      it('should resizey an image', (done) => {
        images.run({
          recipe,
          params: { height: 100 },
          source: 'pokedex.jpg',
          dest: 'resizey-100.jpg',
        }, (err) => {
          if (err) return done(err);

          assert.deepEqual(size(images.getArtifactsPath('resizey-100.jpg')), { type: 'jpg', height: 100, width: 122 });
          done();
        });
      });
    });
  });
});
