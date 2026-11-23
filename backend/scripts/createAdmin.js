// Pemakaian:  npm run seed:admin
// Email & password admin dibaca dari .env (ADMIN_EMAIL, ADMIN_PASSWORD)
const { upsertAccount } = require('./_helpers');

async function main() {
  const email = (process.env.ADMIN_EMAIL || '').trim().toLowerCase();
  const password = process.env.ADMIN_PASSWORD || '';

  if (!email || password.length < 8) {
    throw new Error('Isi ADMIN_EMAIL dan ADMIN_PASSWORD (minimal 8 karakter) di .env terlebih dahulu.');
  }

  await upsertAccount({ email, password, full_name: 'Super Admin SirkulaAI', role: 'admin' });
  console.log(`Akun admin siap: ${email}`);
}

main().catch((err) => {
  console.error('Gagal:', err.message);
  process.exit(1);
});
