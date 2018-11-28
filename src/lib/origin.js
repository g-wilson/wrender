class WrenderOrigin {

  constructor(originPath, fetchFn) {
    if (typeof originPath !== 'string') {
      throw new Error('Expected path to be a string');
    }
    if (typeof fetchFn !== 'function') {
      throw new Error('Expected origin to be a function');
    }

    Object.defineProperty(this, 'path', { enumerable: true, value: originPath });
    Object.defineProperty(this, 'fetch', { enumerable: true, value: fetchFn });
  }

}

module.exports = {

  createOrigin: (originPath, fetchFn) => new WrenderOrigin(originPath, fetchFn),

  instanceofOrigin: input => input instanceof WrenderOrigin,

};
