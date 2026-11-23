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

app.set('trust proxy', env.TRUST_PROXY === '1' ? 1 : false);
app.disable('x-powered-by');

// CSP dimatikan karena frontend memuat tile peta OpenStreetMap dan foto dari Supabase
app.use(helmet({ contentSecurityPolicy: false, crossOriginResourcePolicy: { policy: 'cross-origin' } }));
app.use(cors({
  origin: (origin, cb) => (!origin || env.CORS_ORIGINS.includes(origin) ? cb(null, true) : cb(null, false)),
  methods: ['GET', 'POST', 'PATCH', 'DELETE', 'OPTIONS'],
  allowedHeaders: ['Content-Type', 'Authorization']
}));
app.use(express.json({ limit: '100kb' }));

app.use('/api', apiLimiter, routes);
app.use('/api', notFound); // semua /api yang tidak cocok -> 404 JSON

// Produksi: Express melayani hasil build frontend
const distPath = path.join(__dirname, '../../frontend/dist');
if (fs.existsSync(distPath)) {
  app.use(express.static(distPath));
  app.get(/^\/(?!api).*/, (_req, res) => res.sendFile(path.join(distPath, 'index.html')));
} else {
  app.get('/', (_req, res) => res.send('SirkulaAI Backend API aktif.'));
}

app.use(errorHandler);

module.exports = app;
