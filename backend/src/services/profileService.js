const { supabaseAdmin } = require('../config/supabase');

async function getProfile(userId) {
  const { data } = await supabaseAdmin.from('profiles').select('*').eq('id', userId).maybeSingle();
  return data || null;
}

// Akun yang dibuat langsung di dashboard Supabase belum punya profil.
// Selalu dibuat dengan role 'user'. Role lain hanya boleh diberikan lewat
// script seed atau panel admin, tidak lagi ditebak dari awalan email.
async function ensureProfile(authUser) {
  const existing = await getProfile(authUser.id);
  if (existing) return existing;

  const { data, error } = await supabaseAdmin
    .from('profiles')
    .insert({
      id: authUser.id,
      email: authUser.email,
      full_name: authUser.user_metadata?.full_name || authUser.email.split('@')[0],
      role: 'user',
      is_active: true
    })
    .select('*')
    .single();

  if (error) throw error;
  return data;
}

module.exports = { getProfile, ensureProfile };
