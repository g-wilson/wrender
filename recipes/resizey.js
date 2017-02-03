module.exports = {
  path: '/resizey/:height/:source',
  recipe(image, params) {
    image.resize(null, parseInt(params.height, 10));
  }
};
