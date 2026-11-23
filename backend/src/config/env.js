require('dotenv').config();

const NODE_ENV = process.env.NODE_ENV || 'development';

const toList = (value, fallback = '') =>
  (value || fallback).split(',').map((s) => s.trim()).filter(Boolean);

const env = Object.freeze({
  NODE_ENV,
  IS_PROD: NODE_ENV === 'production',
  PORT: Number(process.env.PORT) || 5000,
  TRUST_PROXY: process.env.TRUST_PROXY || '0',
  CORS_ORIGINS: toList(process.env.CORS_ORIGIN, 'http://localhost:5173'),

  SUPABASE_URL: process.env.SUPABASE_URL,
  SUPABASE_ANON_KEY: process.env.SUPABASE_ANON_KEY,
  SUPABASE_SERVICE_ROLE_KEY: process.env.SUPABASE_SERVICE_ROLE_KEY,
  BUCKET_REPORTS: process.env.STORAGE_BUCKET_REPORTS || 'report-photos',
  BUCKET_EVIDENCE: process.env.STORAGE_BUCKET_EVIDENCE || 'cleanup-evidences',

  GEMINI_API_KEY: (process.env.GEMINI_API_KEY || '').trim(),
  GEMINI_MODEL: process.env.GEMINI_MODEL || 'gemini-2.5-flash',
  AI_FALLBACK_MODE: process.env.AI_FALLBACK_MODE === 'error' ? 'error' : 'mock'
});

// Variabel yang wajib ada agar auth & database berfungsi
const REQUIRED = ['SUPABASE_URL', 'SUPABASE_ANON_KEY', 'SUPABASE_SERVICE_ROLE_KEY'];
const missing = REQUIRED.filter((key) => !env[key]);
if (missing.length) {
  throw new Error(`Variabel .env belum diisi: ${missing.join(', ')}`);
}
if (!env.GEMINI_API_KEY) {
  console.warn('[env] GEMINI_API_KEY kosong, analisis AI memakai mode fallback.');
}

module.exports = env;
