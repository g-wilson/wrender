module.exports = function errors(context) {
  if (context instanceof Error) return context;
  if (!context.err) context.err = new Error(context.message || 'An error occurred');

  if (context.code) context.err.code = context.code;
  if (context.name) context.err.name = context.name;
  if (context.message) context.err.message = context.message;
  if (context.status) context.err.status = context.status;
  if (context.user_message) context.err.user_message = context.user_message;

  return context.err;
};
