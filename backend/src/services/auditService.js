const { supabaseAdmin } = require('../config/supabase');

// Best effort: kegagalan audit tidak boleh menggagalkan aksi utama
async function logActivity({ actorId, entityType, entityId, action, details = {} }) {
  try {
    const { error } = await supabaseAdmin.from('activity_logs').insert({
      actor_id: actorId || null,
      entity_type: entityType,
      entity_id: entityId ? String(entityId) : null,
      action,
      details_json: details
    });
    if (error) console.warn('[audit]', error.message);
  } catch (err) {
    console.warn('[audit]', err.message);
  }
}

module.exports = { logActivity };
