module.exports = function (fn) {
  return new Promise((resolve, reject) => {
    fn((err, ...args) => {
      if (err) reject(err);
      else resolve(...args);
    });
  });
};
