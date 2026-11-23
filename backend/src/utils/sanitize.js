// Hanya field ini yang boleh dikirim ke klien sebagai data akun
const PUBLIC_FIELDS = [
  'id', 'email', 'full_name', 'role', 'phone', 'age',
  'volunteer_status', 'volunteer_level', 'experience_points',
  'completed_tasks_count', 'is_active'
];

function toPublicUser(profile) {
  if (!profile) return null;
  return PUBLIC_FIELDS.reduce((out, key) => {
    if (profile[key] !== undefined) out[key] = profile[key];
    return out;
  }, {});
}

// Escape karakter wildcard agar input pencarian tidak dianggap pola ilike
function escapeLike(value = '') {
  return String(value).replace(/[\\%_]/g, (c) => `\\${c}`);
}

module.exports = { toPublicUser, escapeLike };
