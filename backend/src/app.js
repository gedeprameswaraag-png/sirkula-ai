
const path = require('path');
const fs = require('fs');
const express = require('express');
const cors = require('cors');
const helmet = require('helmet');

const env = require('./config/env');
const routes = require('./routes');
const { apiLimiter } = require('./middlewares/rateLimiters');
const { notFound, errorHandler } = require('./middlewares/errorHandler');

const app = express();

// =====================================================
// BASIC CONFIGURATION
// =====================================================

app.set('trust proxy', env.TRUST_PROXY === '1' ? 1 : false);
app.disable('x-powered-by');

// =====================================================
// CORS CONFIGURATION
// =====================================================

const corsOptions = {
  origin: (origin, callback) => {
    // Izinkan request tanpa Origin (contoh: server-to-server)
    if (!origin) {
      return callback(null, true);
    }

    // Periksa apakah origin terdaftar
    if (env.CORS_ORIGINS.includes(origin)) {
      return callback(null, true);
    }

    return callback(
      new Error(`Origin tidak diizinkan oleh CORS: ${origin}`)
    );
  },

  methods: ['GET', 'POST', 'PATCH', 'DELETE', 'OPTIONS'],

  allowedHeaders: [
    'Content-Type',
    'Authorization'
  ],

  optionsSuccessStatus: 204
};

// CORS harus dipasang sebelum middleware lainnya
app.use(cors(corsOptions));

// Tangani preflight request secara eksplisit
app.options('*', cors(corsOptions));

// =====================================================
// SECURITY MIDDLEWARE
// =====================================================

app.use(
  helmet({
    contentSecurityPolicy: false,
    crossOriginResourcePolicy: {
      policy: 'cross-origin'
    }
  })
);

// =====================================================
// BODY PARSER
// =====================================================

app.use(express.json({
  limit: '100kb'
}));

// =====================================================
// API ROUTES
// =====================================================

// Rate limiter untuk seluruh API
app.use('/api', apiLimiter);

// Semua endpoint API
app.use('/api', routes);

// Handler untuk endpoint API yang tidak ditemukan
app.use('/api', notFound);

// =====================================================
// FRONTEND STATIC FILES
// =====================================================

const distPath = path.join(
  __dirname,
  '../../frontend/dist'
);

if (fs.existsSync(distPath)) {
  app.use(express.static(distPath));

  // React SPA fallback
  app.get(/^\/(?!api).*/, (_req, res) => {
    res.sendFile(
      path.join(distPath, 'index.html')
    );
  });
} else {
  app.get('/', (_req, res) => {
    res.send('SirkulaAI Backend API aktif.');
  });
}

// =====================================================
// GLOBAL ERROR HANDLER
// =====================================================

app.use(errorHandler);

module.exports = app;
