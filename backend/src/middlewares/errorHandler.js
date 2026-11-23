const multer = require('multer');
const ApiError = require('../utils/ApiError');
const env = require('../config/env');

function notFound(req, _res, next) {
  next(ApiError.notFound(`Endpoint ${req.method} ${req.originalUrl} tidak ditemukan.`));
}

// eslint-disable-next-line no-unused-vars
function errorHandler(err, _req, res, _next) {
  if (err instanceof multer.MulterError) {
    const tooBig = err.code === 'LIMIT_FILE_SIZE';
    return res.status(tooBig ? 413 : 400).json({
      success: false,
      message: tooBig ? 'Ukuran gambar maksimal 5 MB.' : 'Upload gambar tidak valid.'
    });
  }

  if (err instanceof ApiError) {
    return res.status(err.status).json({ success: false, message: err.message });
  }

  // Body JSON rusak
  if (err.type === 'entity.parse.failed') {
    return res.status(400).json({ success: false, message: 'Format JSON tidak valid.' });
  }

  // Error tak terduga: detail hanya di log server, bukan ke klien
  console.error('[error]', err);
  res.status(500).json({
    success: false,
    message: env.IS_PROD ? 'Terjadi kesalahan pada server.' : err.message || 'Terjadi kesalahan pada server.'
  });
}

module.exports = { notFound, errorHandler };
