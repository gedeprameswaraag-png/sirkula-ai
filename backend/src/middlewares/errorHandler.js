const multer = require('multer');
const ApiError = require('../utils/ApiError');

function notFound(req, _res, next) {
  next(ApiError.notFound(`Endpoint ${req.method} ${req.originalUrl} tidak ditemukan.`));
}

// eslint-disable-next-line no-unused-vars
function errorHandler(err, req, res, _next) {
  // Penyebab asli selalu tercatat di Vercel -> Logs.
  console.error('[API Error]', {
    method: req.method,
    path: req.originalUrl,
    name: err.name,
    status: err.statusCode || err.status,
    message: err.message,
    stack: err.stack
  });

  if (res.headersSent) return _next(err);

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

  // Origin ditolak CORS
  if (String(err.message || '').startsWith('Origin tidak diizinkan')) {
    return res.status(403).json({ success: false, message: err.message });
  }

  // Error tak terduga: detail hanya tampil jika DEBUG_ERRORS=true
  const body = {
    success: false,
    message: 'Terjadi kesalahan pada server.'
  };

  if (process.env.DEBUG_ERRORS === 'true') {
    body.debug = err.message || String(err);
  }

  return res.status(500).json(body);
}

module.exports = { notFound, errorHandler };