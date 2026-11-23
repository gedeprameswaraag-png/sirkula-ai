const multer = require('multer');
const ApiError = require('../utils/ApiError');

const MAX_SIZE = 5 * 1024 * 1024;
const ALLOWED_MIME = new Set(['image/jpeg', 'image/png', 'image/webp']);

const uploader = multer({
  storage: multer.memoryStorage(),
  limits: { fileSize: MAX_SIZE, files: 1 },
  fileFilter: (_req, file, cb) => {
    if (!ALLOWED_MIME.has(file.mimetype)) {
      return cb(ApiError.badRequest('Format gambar harus JPG, PNG, atau WEBP.'));
    }
    cb(null, true);
  }
});

// Cek "magic bytes" agar isi file benar-benar gambar, bukan hanya percaya header
function detectImageType(buf) {
  if (!buf || buf.length < 12) return null;
  if (buf[0] === 0xff && buf[1] === 0xd8 && buf[2] === 0xff) return 'image/jpeg';
  if (buf.subarray(0, 8).equals(Buffer.from([0x89, 0x50, 0x4e, 0x47, 0x0d, 0x0a, 0x1a, 0x0a]))) return 'image/png';
  if (buf.toString('ascii', 0, 4) === 'RIFF' && buf.toString('ascii', 8, 12) === 'WEBP') return 'image/webp';
  return null;
}

function verifySignature(req, _res, next) {
  if (!req.file) return next();
  const real = detectImageType(req.file.buffer);
  if (!real) return next(new ApiError(415, 'Isi file bukan gambar JPG, PNG, atau WEBP yang valid.'));
  req.file.mimetype = real; // pakai tipe hasil deteksi, bukan klaim klien
  next();
}

// Pemakaian di route: uploadImage('image') -> [multer, cek signature]
const uploadImage = (field = 'image') => [uploader.single(field), verifySignature];

module.exports = { uploadImage, detectImageType };
