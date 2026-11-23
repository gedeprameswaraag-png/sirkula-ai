const { supabaseAdmin } = require('../config/supabase');

// Middleware opsional: mengenali user jika membawa token, tapi tetap mengizinkan guest lewat
const optionalAuth = async (req, res, next) => {
  try {
    const authHeader = req.headers.authorization;
    if (!authHeader || !authHeader.startsWith('Bearer ')) {
      req.user = null;
      return next();
    }

    const token = authHeader.split(' ')[1];
    const { data: { user } } = await supabaseAdmin.auth.getUser(token);
    if (!user) {
      req.user = null;
      return next();
    }

    const { data: profile } = await supabaseAdmin
      .from('profiles')
      .select('*')
      .eq('id', user.id)
      .single();

    req.user = profile ? { ...user, ...profile } : { ...user, role: 'user' };
    next();
  } catch {
    req.user = null;
    next();
  }
};

// Middleware wajib login
const requireAuth = async (req, res, next) => {
  try {
    const authHeader = req.headers.authorization;
    if (!authHeader || !authHeader.startsWith('Bearer ')) {
      return res.status(401).json({ success: false, message: 'Silakan login terlebih dahulu.' });
    }

    const token = authHeader.split(' ')[1];
    const { data: { user }, error } = await supabaseAdmin.auth.getUser(token);

    if (error || !user) {
      return res.status(401).json({ success: false, message: 'Sesi tidak valid atau telah kedaluwarsa.' });
    }

    let { data: profile } = await supabaseAdmin
      .from('profiles')
      .select('*')
      .eq('id', user.id)
      .single();

    // Auto-create profil jika akun dibuat langsung lewat dashboard Supabase
    if (!profile) {
      const autoRole = user.email?.startsWith('admin')
        ? 'admin'
        : user.email?.startsWith('relawan')
        ? 'volunteer'
        : 'user';

      const { data: newProfile, error: insErr } = await supabaseAdmin
        .from('profiles')
        .insert({
          id: user.id,
          email: user.email,
          full_name: user.email.split('@')[0],
          role: autoRole,
          volunteer_status: autoRole === 'volunteer' ? 'verified' : 'unverified',
          is_active: true
        })
        .select('*')
        .single();

      if (insErr) {
        return res.status(403).json({ success: false, message: insErr.message });
      }
      profile = newProfile;
    }

    if (!profile.is_active) {
      return res.status(403).json({ success: false, message: 'Akun Anda telah dinonaktifkan.' });
    }

    req.user = { ...user, ...profile };
    next();
  } catch (err) {
    res.status(500).json({ success: false, message: 'Gagal memverifikasi autentikasi.' });
  }
};

const requireRole = (...allowedRoles) => {
  return (req, res, next) => {
    if (!req.user || !allowedRoles.includes(req.user.role)) {
      return res.status(403).json({
        success: false,
        message: `Akses ditolak. Fitur ini khusus untuk: ${allowedRoles.join(', ')}.`
      });
    }
    next();
  };
};

module.exports = { optionalAuth, requireAuth, requireRole };