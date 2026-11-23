const rateLimit = require('express-rate-limit');

const build = (windowMs, limit, message) =>
  rateLimit({
    windowMs,
    limit,
    standardHeaders: 'draft-7',
    legacyHeaders: false,
    message: { success: false, message }
  });

// Anti brute-force login
const loginLimiter = build(15 * 60 * 1000, 10, 'Terlalu banyak percobaan login. Coba lagi dalam 15 menit.');
// Anti spam pendaftaran akun
const registerLimiter = build(60 * 60 * 1000, 10, 'Terlalu banyak pendaftaran dari jaringan ini. Coba lagi nanti.');
// Laporan guest memakai kuota Gemini, jadi dibatasi
const reportLimiter = build(60 * 60 * 1000, 30, 'Batas pengiriman laporan per jam tercapai. Coba lagi nanti.');
// Batas umum untuk seluruh API
const apiLimiter = build(60 * 1000, 240, 'Terlalu banyak permintaan. Coba lagi sebentar.');

module.exports = { loginLimiter, registerLimiter, reportLimiter, apiLimiter };
