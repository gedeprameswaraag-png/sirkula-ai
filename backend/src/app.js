
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

// Di Vercel selalu ada 1 proxy di depan aplikasi.
app.set('trust proxy', env.TRUST_PROXY === '0' && !process.env.VERCEL ? false : 1);
app.disable('x-powered-by');

// =====================================================
// CORS CONFIGURATION
// =====================================================

// Browser mengirim header Origin pada setiap POST, termasuk saat frontend
// dan backend satu domain. Origin yang sama dengan Host server otomatis
// diizinkan, sisanya harus terdaftar di CORS_ORIGIN.
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

  if (!origin || sameOrigin || env.CORS_ORIGINS.includes(origin)) {
    return callback(null, {
      origin: true,
      methods: ['GET', 'POST', 'PATCH', 'DELETE', 'OPTIONS'],
      allowedHeaders: ['Content-Type', 'Authorization'],
      optionsSuccessStatus: 204
    });
  }

  return callback(new Error(`Origin tidak diizinkan oleh CORS: ${origin}`));
};

// CORS harus dipasang sebelum middleware lainnya
app.use(cors(corsOptionsDelegate));

// Tangani preflight request secara eksplisit
app.options(/.*/, cors(corsOptionsDelegate));

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

// Di luar Vercel (lokal / server biasa) aplikasi dijalankan langsung.
if (!process.env.VERCEL && require.main === module) {
  app.listen(env.PORT, '0.0.0.0', () => {
    console.log(`SirkulaAI Backend berjalan pada port ${env.PORT}`);
  });
}

module.exports = app;

