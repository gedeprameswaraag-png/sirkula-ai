const { createClient } = require('@supabase/supabase-js');
const env = require('./env');

const options = { auth: { autoRefreshToken: false, persistSession: false } };

// Service role: melewati RLS. Hanya dipakai untuk query data & operasi admin.
const supabaseAdmin = createClient(env.SUPABASE_URL, env.SUPABASE_SERVICE_ROLE_KEY, options);

// Anon key: khusus proses login / refresh token milik pengguna.
// Dipisah agar sesi pengguna tidak pernah menempel pada client service role.
const supabaseAuth = createClient(env.SUPABASE_URL, env.SUPABASE_ANON_KEY, options);

module.exports = { supabaseAdmin, supabaseAuth };
