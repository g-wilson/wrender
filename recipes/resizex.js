module.exports = {
  path: '/resizex/:width/:source',
  recipe(image, params) {
    image.resize(parseInt(params.width, 10));
  }
};
