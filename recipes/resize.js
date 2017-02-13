module.exports = {
  path: '/resize/:width/:height/:source',
  recipe(image, params) {
    image.resize(parseInt(params.width, 10), parseInt(params.height, 10));
    image.ignoreAspectRatio();
  }
};
