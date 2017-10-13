const ORIGIN_REGEX = /\/:origin$/;
const sharp = require('sharp');

class Recipe {

  constructor (recipePath, processFn) {
    if (typeof recipePath !== 'string') {
      throw new Error('Expected path to be a string');
    }
    if (typeof processFn !== 'function') {
      throw new Error('Expected recipe to be a function');
    }
    if (!ORIGIN_REGEX.test(recipePath)) {
      throw new Error(`Expected recipe path "${recipePath}" to end with "/:origin"`);
    }

    Object.defineProperty(this, 'path', { enumerable: true, value: recipePath });
    Object.defineProperty(this, 'process', { enumerable: true, value: processFn });
  }

  pipeline(image, params, res) {

    // Convert to JPEG? GIFs become still-frames
    if (params.mimetype !== 'image/jpeg' && params.convertToJPEG) {
      params.mimetype = 'image/jpeg';
      image.background({ r: 0, g: 0, b: 0, alpha: 0 });
      image.flatten();
      image.toFormat(sharp.format.jpeg);
    }

    // Respect EXIF orientation headers
    if (params.mimetype === 'image/jpeg') {
      image.rotate();
    }

    // Apply recipe
    this.process(image, params);

    // Always apply compression at the end
    if (params.mimetype === 'image/jpeg') {
      image.jpeg({ quality: params.quality || 85 });
    }

    // Discard EXIF
    if (params.includeEXIF === true) {
      image.withMetadata();
    }

    res.set('Content-Type', params.mimetype);
    image.pipe(res);
  }

}

module.exports = {

  createRecipe: (recipePath, processFn) => new Recipe(recipePath, processFn),

  invokeRecipe(recipe, image, params) {
    if (!(recipe instanceof Recipe)) throw new Error('Expected recipe to be an instance of Recipe');
    recipe.recipe(image, params);
  },

  instanceofRecipe: input => input instanceof Recipe,

  regex: ORIGIN_REGEX,

};
