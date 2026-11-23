const { supabaseAdmin } = require('../config/supabase');
const { ensureProfile } = require('../services/profileService');
const ApiError = require('../utils/ApiError');

const ADMIN_ROLES = ['admin', 'super_admin'];

function extractToken(req) {
  const header = req.headers.authorization || '';
  return header.startsWith('Bearer ') ? header.slice(7).trim() : null;
}

async function resolveUser(token) {
  const { data, error } = await supabaseAdmin.auth.getUser(token);
  if (error || !data?.user) return null;
  const profile = await ensureProfile(data.user);
  return { profile, token };
}

// Wajib login. Mengisi req.user (profil) dan req.token
async function authenticate(req, _res, next) {
  try {
    const token = extractToken(req);
    if (!token) throw ApiError.unauthorized();

    const resolved = await resolveUser(token);
    if (!resolved) throw ApiError.unauthorized('Sesi tidak valid atau telah kedaluwarsa.');
    if (!resolved.profile.is_active) throw ApiError.forbidden('Akun Anda telah dinonaktifkan.');

    req.user = resolved.profile;
    req.token = token;
    next();
  } catch (err) {
    next(err);
  }
}

// Boleh guest. Jika token valid, req.user terisi; jika tidak, req.user = null
async function optionalAuth(req, _res, next) {
  req.user = null;
  try {
    const token = extractToken(req);
    if (token) {
      const resolved = await resolveUser(token);
      if (resolved?.profile.is_active) {
        req.user = resolved.profile;
        req.token = token;
      }
    }
  } catch {
    req.user = null;
  }
  next();
}

const requireRole = (...roles) => (req, _res, next) => {
  if (!req.user) return next(ApiError.unauthorized());
  if (!roles.includes(req.user.role)) {
    return next(ApiError.forbidden(`Akses ditolak. Fitur ini khusus untuk: ${roles.join(', ')}.`));
  }
  next();
};

const requireAdmin = requireRole(...ADMIN_ROLES);
const requireVolunteer = requireRole('volunteer', ...ADMIN_ROLES);

module.exports = { authenticate, optionalAuth, requireRole, requireAdmin, requireVolunteer, ADMIN_ROLES };
