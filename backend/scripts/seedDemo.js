// Pemakaian:  npm run seed:demo   (hanya untuk demo/lomba, jangan dijalankan di produksi)
// Password semua akun demo dibaca dari .env (DEMO_PASSWORD)
const env = require('../src/config/env');
const { upsertAccount } = require('./_helpers');

const ACCOUNTS = [
  { email: 'warga@sirkula.id', full_name: 'Budi (Warga Pelapor)', role: 'user' },
  {
    email: 'relawan@sirkula.id',
    full_name: 'Siti (Sukarelawan)',
    role: 'volunteer',
    extra: {
      volunteer_status: 'verified',
      volunteer_level: 'Pemula',
      experience_points: 0,
      completed_tasks_count: 0,
      health_declaration: true
    }
  },
  { email: 'admin@sirkula.id', full_name: 'Admin SirkulaAI', role: 'admin' }
];

async function main() {
  if (env.IS_PROD) throw new Error('seed:demo tidak boleh dijalankan saat NODE_ENV=production.');

  const password = process.env.DEMO_PASSWORD || '';
  if (password.length < 8) throw new Error('Isi DEMO_PASSWORD (minimal 8 karakter) di .env terlebih dahulu.');

  for (const acc of ACCOUNTS) {
    await upsertAccount({ ...acc, password });
    console.log(`Siap digunakan -> ${acc.role}: ${acc.email}`);
  }
}

main().catch((err) => {
  console.error('Gagal:', err.message);
  process.exit(1);
});
