require('dotenv').config();
const { supabaseAdmin } = require('./src/config/supabase');

async function seedAdmin() {
  const email = 'admin@sirkula.id';
  const password = 'Admin123!';
  const fullName = 'Super Admin SirkulaAI';

  console.log('Memeriksa akun admin di Supabase Auth...');

  // 1. Cek apakah user sudah ada di auth.users
  const { data: listData, error: listErr } = await supabaseAdmin.auth.admin.listUsers();
  if (listErr) throw listErr;

  const existing = listData.users.find((u) => u.email?.toLowerCase() === email);
  let userId;

  if (existing) {
    // Update password & pastikan terkonfirmasi
    const { data: updated, error: updErr } = await supabaseAdmin.auth.admin.updateUserById(existing.id, {
      password,
      email_confirm: true,
      user_metadata: { full_name: fullName }
    });
    if (updErr) throw updErr;
    userId = updated.user.id;
    console.log('✅ Password akun admin yang sudah ada berhasil diperbarui.');
  } else {
    // Buat akun baru melalui API resmi Supabase Auth Admin
    const { data: created, error: createErr } = await supabaseAdmin.auth.admin.createUser({
      email,
      password,
      email_confirm: true,
      user_metadata: { full_name: fullName }
    });
    if (createErr) throw createErr;
    userId = created.user.id;
    console.log('✅ Akun admin baru berhasil dibuat di Supabase Auth.');
  }

  // 2. Pastikan profilnya memiliki role = 'admin' dan is_active = true
  const { error: profErr } = await supabaseAdmin
    .from('profiles')
    .upsert({
      id: userId,
      email,
      full_name: fullName,
      role: 'admin',
      is_active: true
    });

  if (profErr) throw profErr;

  console.log('====================================');
  console.log('SIAP LOGIN PORTAL ADMIN:');
  console.log('Email    :', email);
  console.log('Password :', password);
  console.log('====================================');
}

seedAdmin().catch((err) => {
  console.error('❌ Gagal:', err.message);
});