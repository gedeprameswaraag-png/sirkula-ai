require('dotenv').config();
const { supabaseAdmin } = require('./config/supabase');

const demoAccounts = [
  { email: 'warga@sirkula.id', password: 'Password123!', full_name: 'Budi (Warga Pelapor)', role: 'user' },
  { email: 'relawan@sirkula.id', password: 'Password123!', full_name: 'Siti (Sukarelawan)', role: 'volunteer' },
  { email: 'admin@sirkula.id', password: 'Password123!', full_name: 'Admin SirkulaAI', role: 'admin' }
];

async function seed() {
  // Ambil daftar user yang mungkin sudah ada di Auth
  const { data: existingUsers } = await supabaseAdmin.auth.admin.listUsers();

  for (const acc of demoAccounts) {
    let userId = existingUsers?.users?.find((u) => u.email === acc.email)?.id;

    if (!userId) {
      const { data, error } = await supabaseAdmin.auth.admin.createUser({
        email: acc.email,
        password: acc.password,
        email_confirm: true
      });
      if (error) {
        console.log(`Gagal buat user ${acc.email}:`, error.message);
        continue;
      }
      userId = data.user.id;
    }

    // Masukkan atau perbarui data di tabel public.profiles
    const { error: profErr } = await supabaseAdmin.from('profiles').upsert({
      id: userId,
      full_name: acc.full_name,
      role: acc.role,
      is_active: true
    });

    if (profErr) console.log(`Gagal profil ${acc.email}:`, profErr.message);
    else console.log(`SIAP DIGUNAKAN -> ${acc.role}: ${acc.email}`);
  }
}

seed();