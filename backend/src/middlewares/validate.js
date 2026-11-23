const ApiError = require('../utils/ApiError');

// validate(schema) -> memvalidasi req.body dan menggantinya dengan data yang sudah bersih
module.exports = (schema, source = 'body') => (req, _res, next) => {
  const result = schema.safeParse(req[source]);
  if (!result.success) {
    const first = result.error.issues[0];
    const field = first?.path?.join('.');
    const message = !first || first.message === 'Required'
      ? `Data belum lengkap${field ? `: field "${field}" wajib diisi` : ''}.`
      : first.message;
    return next(ApiError.badRequest(message));
  }
  req[source] = result.data;
  next();
};

// Pastikan parameter URL berupa UUID, mis. validateUuidParams('taskId')
const UUID_RE = /^[0-9a-f]{8}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{12}$/i;
module.exports.validateUuidParams = (...names) => (req, _res, next) => {
  const bad = names.find((n) => !UUID_RE.test(req.params[n] || ''));
  return bad ? next(ApiError.badRequest(`Parameter ${bad} tidak valid.`)) : next();
};
