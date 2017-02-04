const assert = require('assert');
const images = require('../images');
const size = require('image-size');

describe('wrender', () => {
  describe('recipes', () => {
    describe('crop', () => {
      const recipe = (() => {
        const sharp = require('sharp');

        return {
          path: '/crop/:width/:height/:source',
          recipe(image, params) {
            image.resize(parseInt(params.width, 10), parseInt(params.height, 10));
            image.crop(sharp.gravity.center);
            // image.crop(sharp.strategy.entropy);
            // image.crop(sharp.strategy.attention);
          }
        };
      })();

      it('should have the correct path', () => assert.equal(recipe.path, '/crop/:width/:height/:source'));

      it('should crop an image', (done) => {
        images.run({
          recipe,
          params: { height: 100, width: 100 },
          source: 'carthrottle.png',
          dest: 'crop-100x100.png',
        }, (err) => {
          if (err) return done(err);

          assert.deepEquals(size(images.getArtifactsPath('crop-100x100.png')), { type: 'png', height: 100, width: 100 });
          done();
        });
      });
    });
  });
});
