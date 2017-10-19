const assert = require('assert');
const images = require('../images');
const size = require('image-size');

describe('wrender', () => {
  describe('recipes', () => {
    describe('crop', () => {
      const recipe = require('../../src/recipes/proxy');

      it('should have the correct path', () => assert.equal(recipe.path, '/proxy/:origin'));

      it('should compress an image', (done) => {
        images.run({
          recipe,
          source: 'pokedex.jpg',
          dest: 'proxy-1.jpg',
        }, (err) => {
          if (err) return done(err);

          assert.deepEqual(size(images.getArtifactsPath('proxy-1.jpg')), { type: 'jpg', height: 658, width: 800 });
          done();
        });
      });
    });
  });
});
