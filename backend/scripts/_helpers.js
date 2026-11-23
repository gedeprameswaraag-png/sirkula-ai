const { supabaseAdmin } = require('../src/config/supabase');

async function findUserByEmail(email) {
  // listUsers dipaginasi; telusuri sampai ketemu atau habis
  for (let page = 1; page <= 20; page += 1) {
    const { data, error } = await supabaseAdmin.auth.admin.listUsers({ page, perPage: 200 });
    if (error) throw error;
    const found = data.users.find((u) => u.email?.toLowerCase() === email.toLowerCase());
    if (found) return found;
    if (data.users.length < 200) return null;
  }
  return null;
}

// Buat akun Auth (atau perbarui password jika sudah ada) lalu set profilnya
async function upsertAccount({ email, password, full_name, role, extra = {} }) {
  let user = await findUserByEmail(email);

  if (user) {
    const { error } = await supabaseAdmin.auth.admin.updateUserById(user.id, {
      password,
      email_confirm: true,
      user_metadata: { full_name }
    });
    if (error) throw error;
  } else {
    const { data, error } = await supabaseAdmin.auth.admin.createUser({
      email,
      password,
      email_confirm: true,
      user_metadata: { full_name }
    });
    if (error) throw error;
    user = data.user;
  }

  const { error: profileErr } = await supabaseAdmin
    .from('profiles')
    .upsert({ id: user.id, email, full_name, role, is_active: true, ...extra });
  if (profileErr) throw profileErr;

  return user;
}

module.exports = { upsertAccount };
