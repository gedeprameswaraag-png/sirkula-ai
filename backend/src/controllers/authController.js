const { createClient } = require('@supabase/supabase-js');
const { supabaseAdmin } = require('../config/supabase');

// Client publik (anon) khusus untuk memicu alur signUp & verifikasi email resmi Supabase
const supabasePublic = createClient(
  process.env.SUPABASE_URL,
  process.env.SUPABASE_ANON_KEY
);

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
    const err = new Error('Nama lengkap, email aktif, dan kata sandi wajib diisi.');
    err.statusCode = 400;
    throw err;
  }

  if (!health_declaration) {
    const err = new Error('Anda wajib menyetujui pernyataan sehat jasmani dan siap bekerja di lapangan.');
    err.statusCode = 400;
    throw err;
  }

  const cleanEmail = email.trim().toLowerCase();

  // Blokir domain email dummy/sekali pakai yang umum
  const blockedDomains = ['example.com', 'test.com', 'dummy.com', 'mailinator.com', 'tempmail.com', 'yopmail.com'];
  const emailDomain = cleanEmail.split('@')[1] || '';
  if (!emailDomain || blockedDomains.includes(emailDomain)) {
    const err = new Error('Gunakan alamat email asli yang aktif (email dummy/sementara tidak diperbolehkan).');
    err.statusCode = 400;
    throw err;
  }

  // 1. Daftarkan via signUp agar Supabase mengirim link verifikasi ke email asli
  const { data: signUpData, error: signUpErr } = await supabasePublic.auth.signUp({
    email: cleanEmail,
    password,
    options: {
      emailRedirectTo: process.env.FRONTEND_URL || 'http://localhost:5173',
      data: {
        full_name: full_name.trim(),
        role: 'volunteer'
      }
    }
  });

  if (signUpErr) {
    const err = new Error(signUpErr.message);
    err.statusCode = 400;
    throw err;
  }

  // Supabase mengembalikan user dengan identities kosong jika email sudah terdaftar
  if (!signUpData?.user || (signUpData.user.identities && signUpData.user.identities.length === 0)) {
    const err = new Error('Email ini sudah terdaftar. Silakan cek kotak masuk email Anda atau langsung masuk.');
    err.statusCode = 400;
    throw err;
  }

  // 2. Simpan biodata relawan ke tabel profiles (menunggu verifikasi email & Admin)
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
    // Rollback user auth jika gagal simpan profil
    await supabaseAdmin.auth.admin.deleteUser(signUpData.user.id).catch(() => {});
    throw profErr;
  }

  return {
    requires_email_verification: true,
    email: cleanEmail,
    user: profile
  };
};

exports.login = async ({ email, password }, { allowedRoles } = {}) => {
  if (!email || !password) {
    const err = new Error('Email dan kata sandi wajib diisi.');
    err.statusCode = 400;
    throw err;
  }

  const cleanEmail = email.trim().toLowerCase();

  const { data, error } = await supabasePublic.auth.signInWithPassword({
    email: cleanEmail,
    password
  });

  if (error) {
    if (error.message.toLowerCase().includes('email not confirmed')) {
      const err = new Error('Email Anda belum diverifikasi. Silakan buka kotak masuk/spam email Anda dan klik tautan verifikasi terlebih dahulu.');
      err.statusCode = 403;
      throw err;
    }
    const err = new Error('Email atau kata sandi salah.');
    err.statusCode = 401;
    throw err;
  }

  // Pastikan email benar-benar sudah terkonfirmasi
  if (!data.user?.email_confirmed_at) {
    const err = new Error('Email Anda belum diverifikasi. Silakan klik tautan verifikasi yang dikirim ke email Anda.');
    err.statusCode = 403;
    throw err;
  }

  const { data: profile, error: profErr } = await supabaseAdmin
    .from('profiles')
    .select('*')
    .eq('id', data.user.id)
    .single();

  if (profErr || !profile) {
    const err = new Error('Profil pengguna tidak ditemukan.');
    err.statusCode = 404;
    throw err;
  }

  if (allowedRoles && !allowedRoles.includes(profile.role)) {
    const err = new Error('Akun Anda tidak memiliki izin akses untuk portal ini.');
    err.statusCode = 403;
    throw err;
  }

  return {
    session: data.session,
    access_token: data.session.access_token,
    refresh_token: data.session.refresh_token,
    user: profile
  };
};