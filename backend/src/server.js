require('dotenv').config();

const express = require('express');
const cors = require('cors');

const env = require('./config/env');
const apiRoutes = require('./routes/apiRoutes');
const aiRoutes = require('./routes/aiRoutes');

const app = express();
const PORT = env.PORT || 5000;

// =====================================================
// SERVER CONFIGURATION
// =====================================================

app.disable('x-powered-by');

// Aktifkan trust proxy jika aplikasi berjalan di hosting (Vercel, dll.)
if (env.TRUST_PROXY !== '0') {
  app.set('trust proxy', Number(env.TRUST_PROXY) || 1);
}

// =====================================================
// CORS CONFIGURATION
// =====================================================

const allowedOrigins = env.CORS_ORIGINS;

// Browser mengirim header Origin pada setiap POST, termasuk saat frontend
// dan backend berada di domain yang sama. Origin yang sama dengan Host
// server otomatis diizinkan, sisanya harus ada di CORS_ORIGIN.
const corsOptionsDelegate = (req, callback) => {
  const origin = req.header('Origin');
  const host = req.header('X-Forwarded-Host') || req.header('Host');

  let sameOrigin = false;

  if (origin && host) {
    try {
      sameOrigin = new URL(origin).host === host;
    } catch {
      sameOrigin = false;
    }
  }

  if (!origin || sameOrigin || allowedOrigins.includes(origin)) {
    return callback(null, {
      origin: true,
      methods: ['GET', 'POST', 'PUT', 'PATCH', 'DELETE', 'OPTIONS'],
      allowedHeaders: ['Content-Type', 'Authorization'],
      credentials: true
    });
  }

  const error = new Error(`Origin tidak diizinkan oleh CORS: ${origin}`);
  error.status = 403;

  return callback(error);
};

app.use(cors(corsOptionsDelegate));

// =====================================================
// BODY PARSER
// =====================================================

app.use(express.json({ limit: '1mb' }));
app.use(express.urlencoded({ extended: true, limit: '1mb' }));

// =====================================================
// HEALTH CHECK
// =====================================================

app.get('/', (_req, res) => {
  res.json({
    success: true,
    message: 'SirkulaAI Backend is running!',
    environment: env.NODE_ENV
  });
});

app.get('/api/health', (_req, res) => {
  res.json({
    success: true,
    status: 'ok',
    service: 'SirkulaAI Backend',
    timestamp: new Date().toISOString()
  });
});

// =====================================================
// MAIN API ROUTES
// =====================================================

app.use('/api', apiRoutes);

// Endpoint pengujian AI hanya tersedia di development.
if (!env.IS_PROD) {
  app.use('/api/ai', aiRoutes);
}

// =====================================================
// NOT FOUND
// =====================================================

app.use((req, res) => {
  res.status(404).json({
    success: false,
    message: 'Endpoint tidak ditemukan.'
  });
});

// =====================================================
// GLOBAL ERROR HANDLER
// =====================================================

app.use((err, req, res, next) => {
  // Penyebab asli selalu tercatat di Logs (Vercel -> Logs).
  console.error('[API Error]', {
    method: req.method,
    path: req.originalUrl,
    name: err.name,
    status: err.statusCode || err.status,
    message: err.message,
    stack: err.stack
  });

  if (res.headersSent) {
    return next(err);
  }

  let status = err.statusCode || err.status || 500;
  let message = err.message;

  if (err.code === 'LIMIT_FILE_SIZE') {
    status = 413;
    message = 'Ukuran gambar terlalu besar.';
  }

  if (err.type === 'entity.parse.failed') {
    status = 400;
    message = 'Format JSON tidak valid.';
  }

  if (!Number.isInteger(status) || status < 400 || status > 599) {
    status = 500;
  }

  // Error 4xx dan ApiError (mis. gagal upload ke storage) aman ditampilkan.
  // Error tak terduga disamarkan, kecuali DEBUG_ERRORS=true.
  const exposeMessage = status < 500 || err.name === 'ApiError';

  const body = {
    success: false,
    message: exposeMessage
      ? message || 'Permintaan tidak valid.'
      : 'Terjadi kesalahan pada server.'
  };

  if (!exposeMessage && process.env.DEBUG_ERRORS === 'true') {
    body.debug = err.message;
  }

  return res.status(status).json(body);
});

// =====================================================
// START SERVER
// =====================================================

// Vercel menjalankan app sebagai fungsi serverless, tanpa app.listen.
if (!process.env.VERCEL) {
  app.listen(PORT, '0.0.0.0', () => {
    console.log(`SirkulaAI Backend berjalan pada port ${PORT}`);
    console.log(`Environment: ${env.NODE_ENV}`);
    console.log(`AI test endpoint: ${env.IS_PROD ? 'disabled' : 'enabled'}`);
  });
}

module.exports = app;