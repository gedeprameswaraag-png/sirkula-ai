
require('dotenv').config();

const express = require('express');
const cors = require('cors');

const env = require('./config/env');
const app = express();

const apiRoutes = require('./routes/apiRoutes');
const aiRoutes = require('./routes/aiRoutes');

const PORT = env.PORT || 5000;

// =====================================================
// SERVER CONFIGURATION
// =====================================================

app.disable('x-powered-by');

// Aktifkan trust proxy jika aplikasi berjalan di hosting
if (env.TRUST_PROXY !== '0') {
  app.set('trust proxy', Number(env.TRUST_PROXY) || 1);
}

// =====================================================
// CORS CONFIGURATION
// =====================================================

const allowedOrigins = env.CORS_ORIGINS;

const corsOptions = {
  origin: (origin, callback) => {
    // Izinkan request tanpa Origin, misalnya health check server.
    if (!origin) return callback(null, true);

    if (allowedOrigins.includes(origin)) {
      return callback(null, true);
    }

    return callback(new Error('Origin tidak diizinkan oleh CORS.'));
  },
  methods: ['GET', 'POST', 'PUT', 'PATCH', 'DELETE', 'OPTIONS'],
  allowedHeaders: ['Content-Type', 'Authorization'],
  credentials: true
};

app.use(cors(corsOptions));

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
  console.error('[API Error]:', err.message);

  if (res.headersSent) {
    return next(err);
  }

  let status = err.statusCode || err.status || 500;

  if (err.code === 'LIMIT_FILE_SIZE') {
    status = 413;
  }

  res.status(status).json({
    success: false,
    message:
      status >= 500
        ? 'Terjadi kesalahan pada server.'
        : err.message || 'Permintaan tidak valid.'
  });
});

// =====================================================
// START SERVER
// =====================================================

app.listen(PORT, '0.0.0.0', () => {
  console.log(`SirkulaAI Backend berjalan pada port ${PORT}`);
  console.log(`Environment: ${env.NODE_ENV}`);
  console.log(`AI test endpoint: ${env.IS_PROD ? 'disabled' : 'enabled'}`);
});
