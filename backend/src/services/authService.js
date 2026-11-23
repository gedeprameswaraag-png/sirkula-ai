
const { createClient } = require('@supabase/supabase-js');
const { supabaseAdmin } = require('../config/supabase');

const supabasePublic = createClient(
  process.env.SUPABASE_URL,
  process.env.SUPABASE_ANON_KEY
);

const BLOCKED_DUMMY_DOMAINS = [
  'example.com',
  'example.org',
  'example.net',
  'test.com',
  'dummy.com',
  'mailinator.com',
  'tempmail.com',
  'yopmail.com',
  '10minutemail.com',
  'guerrillamail.com'
];

function createError(message, statusCode) {
  const error = new Error(message);
  error.statusCode = statusCode;
  return error;
}

// ==========================================
// REGISTER VOLUNTEER
// ==========================================

exports.registerVolunteer = async (payload) => {
  const {
    full_name,
    email,
    password,
    age,
    phone,
    medical_history,
    health_declaration
  } = payload;

  if (!full_name || !email || !password) {
    throw createError(
      'Nama lengkap, email aktif, dan kata sandi wajib diisi.',
      400
    );
  }

  if (password.length < 6) {
    throw createError('Kata sandi minimal 6 karakter.', 400);
  }

  if (!health_declaration) {
    throw createError(
      'Anda wajib menyetujui pernyataan sehat jasmani dan siap bekerja di lapangan.',
      400
    );
  }

  const cleanEmail = email.trim().toLowerCase();

  const emailRegex = /^[^\s@]+@[^\s@]+\.[^\s@]+$/;

  if (!emailRegex.test(cleanEmail)) {
    throw createError('Format alamat email tidak valid.', 400);
  }

  const domain = cleanEmail.split('@')[1] || '';

  if (BLOCKED_DUMMY_DOMAINS.includes(domain)) {
    throw createError(
      'Email dummy atau email sementara tidak diperbolehkan. Gunakan email asli yang aktif.',
      400
    );
  }

  // 1. Registrasi akun melalui Supabase Auth
  const { data: signUpData, error: signUpErr } =
    await supabasePublic.auth.signUp({
      email: cleanEmail,
      password,
      options: {
        emailRedirectTo:
          process.env.FRONTEND_URL || 'http://localhost:5173',
        data: {
          full_name: full_name.trim(),
          role: 'volunteer'
        }
      }
    });

  if (signUpErr) {
    throw createError(signUpErr.message, 400);
  }

  if (
    !signUpData?.user ||
    (signUpData.user.identities &&
      signUpData.user.identities.length === 0)
  ) {
    throw createError(
      'Email ini sudah terdaftar. Silakan cek kotak masuk email Anda untuk verifikasi atau langsung masuk.',
      400
    );
  }

  // 2. Simpan profil relawan
  const { data: profile, error: profErr } = await supabaseAdmin
    .from('profiles')
    .upsert({
      id: signUpData.user.id,
      email: cleanEmail,
      full_name: full_name.trim(),
      role: 'volunteer',
      age: age ? Number(age) : null,
      phone: phone?.trim() || null,
      medical_history: medical_history?.trim() || 'Tidak ada',
      health_declaration: Boolean(health_declaration),
      volunteer_status: 'pending_verification',
      is_active: false
    })
    .select()
    .single();

  if (profErr) {
    // Hapus akun Auth jika penyimpanan profil gagal
    await supabaseAdmin.auth.admin
      .deleteUser(signUpData.user.id)
      .catch(() => {});

    throw profErr;
  }

  return {
    requires_email_verification: true,
    email: cleanEmail,
    user: profile
  };
};

// ==========================================
// LOGIN
// ==========================================

exports.login = async ({ email, password }, { allowedRoles } = {}) => {
  if (!email || !password) {
    throw createError('Email dan kata sandi wajib diisi.', 400);
  }

  const cleanEmail = email.trim().toLowerCase();

  const { data, error } =
    await supabasePublic.auth.signInWithPassword({
      email: cleanEmail,
      password
    });

  if (error) {
    if (error.message.toLowerCase().includes('email not confirmed')) {
      throw createError(
        'Email Anda belum diverifikasi. Silakan periksa kotak masuk atau spam email Anda.',
        403
      );
    }

    throw createError('Email atau kata sandi salah.', 401);
  }

  if (!data?.session || !data?.user) {
    throw createError('Gagal membuat sesi login.', 401);
  }

  if (!data.user.email_confirmed_at) {
    throw createError(
      'Email Anda belum diverifikasi. Silakan klik tautan verifikasi yang dikirim ke email Anda.',
      403
    );
  }

  // Ambil profil pengguna
  const { data: profile, error: profErr } = await supabaseAdmin
    .from('profiles')
    .select('*')
    .eq('id', data.user.id)
    .single();

  if (profErr || !profile) {
    throw createError('Profil pengguna tidak ditemukan.', 404);
  }

  // Validasi role
  if (allowedRoles && !allowedRoles.includes(profile.role)) {
    throw createError(
      'Akun Anda tidak memiliki izin akses untuk portal ini.',
      403
    );
  }

  // Validasi status akun
  if (!profile.is_active) {
    throw createError(
      'Akun Anda belum aktif atau telah dinonaktifkan.',
      403
    );
  }

  return {
    session: data.session,
    access_token: data.session.access_token,
    refresh_token: data.session.refresh_token,
    user: profile
  };
};

// ==========================================
// REFRESH TOKEN
// ==========================================

exports.refresh = async (refreshToken) => {
  if (!refreshToken) {
    throw createError('Refresh token tidak ditemukan.', 400);
  }

  const { data, error } =
    await supabasePublic.auth.refreshSession({
      refresh_token: refreshToken
    });

  if (error || !data?.session) {
    throw createError(
      'Sesi tidak valid atau telah kedaluwarsa. Silakan login kembali.',
      401
    );
  }

  return {
    session: data.session,
    access_token: data.session.access_token,
    refresh_token: data.session.refresh_token,
    user: data.user
  };
};

// ==========================================
// LOGOUT
// ==========================================

exports.logout = async (token) => {
  if (!token) {
    throw createError('Token autentikasi tidak ditemukan.', 401);
  }

  const { error } = await supabaseAdmin.auth.admin.signOut(
    token,
    'local'
  );

  if (error) {
    throw createError('Gagal mengakhiri sesi.', 400);
  }

  return {
    logged_out: true
  };
};
