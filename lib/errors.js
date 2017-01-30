const errors = module.exports = {};

const TYPES = {
  ArgumentError: 400,
  AccessForbidden: 403,
  NotFoundError: 404,
  NotImplementedError: 501,
};

Object.keys(TYPES).forEach(name => {
  errors[name] = function (code, err) {
    err.code = code;
    err.name = name;
    err.status = TYPES[name];
    return err;
  };
});