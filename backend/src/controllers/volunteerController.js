const { supabaseAdmin } = require('../config/supabase');
const env = require('../config/env');
const { uploadPrivateImage, removeFile, getSignedImageUrl } = require('../services/storageService');
const { logActivity } = require('../services/auditService');
const { ADMIN_ROLES } = require('../middlewares/auth');
const { escapeLike } = require('../utils/sanitize');
const asyncHandler = require('../utils/asyncHandler');
const ApiError = require('../utils/ApiError');

const ACTIVE_TASK_STATUSES = ['in_progress', 'submitted'];

const isMember = async (groupId, userId) => {
  const { data } = await supabaseAdmin
    .from('volunteer_group_members')
    .select('volunteer_id')
    .eq('group_id', groupId)
    .eq('volunteer_id', userId)
    .maybeSingle();
  return Boolean(data);
};

// Helper untuk melampirkan nama pengirim & data hotspot secara aman tanpa join FK Supabase
async function attachSendersAndHotspots(messages) {
  if (!messages || messages.length === 0) return [];

  const senderIds = [...new Set(messages.map((m) => m.sender_id).filter(Boolean))];
  const hotspotIds = [...new Set(messages.map((m) => m.hotspot_id).filter(Boolean))];

  const [{ data: profiles }, { data: hotspots }] = await Promise.all([
    senderIds.length
      ? supabaseAdmin.from('profiles').select('id, full_name, volunteer_level').in('id', senderIds)
      : { data: [] },
    hotspotIds.length
      ? supabaseAdmin.from('hotspots').select('id, title, priority_level, latitude, longitude, status').in('id', hotspotIds)
      : { data: [] }
  ]);

  const profileMap = Object.fromEntries((profiles || []).map((p) => [p.id, p]));
  const hotspotMap = Object.fromEntries((hotspots || []).map((h) => [h.id, h]));

  return messages.map((m) => ({
    ...m,
    profiles: profileMap[m.sender_id] || { full_name: 'Relawan' },
    hotspots: m.hotspot_id ? hotspotMap[m.hotspot_id] || null : null
  }));
}

exports.getDashboardData = asyncHandler(async (req, res) => {
  const userId = req.user.id;

  const [{ data: profile }, { data: memberships }] = await Promise.all([
    supabaseAdmin.from('profiles').select('*').eq('id', userId).single(),
    supabaseAdmin
      .from('volunteer_group_members')
      .select('group_id, role_in_group, volunteer_groups (*)')
      .eq('volunteer_id', userId)
  ]);

  const groupIds = (memberships || []).map((m) => m.group_id);

  let taskQuery = supabaseAdmin
    .from('cleanup_tasks')
    .select('*, hotspots (id, title, latitude, longitude, priority_level, priority_score, status), volunteer_groups (id, name)')
    .order('created_at', { ascending: false });

  taskQuery = groupIds.length
    ? taskQuery.or(`volunteer_id.eq.${userId},group_id.in.(${groupIds.join(',')})`)
    : taskQuery.eq('volunteer_id', userId);

  const { data: tasks, error } = await taskQuery;
  if (error) throw error;

  const enrichedTasks = await Promise.all(
    (tasks || []).map(async (t) => ({
      ...t,
      proof_photo_url: await getSignedImageUrl(env.BUCKET_EVIDENCE, t.proof_photo_path)
    }))
  );

  res.json({
    success: true,
    profile,
    my_groups: (memberships || []).map((m) => ({ ...m.volunteer_groups, role_in_group: m.role_in_group })),
    tasks: enrichedTasks
  });
});

// Relawan mengambil titik hotspot (individu atau bersama grup)
exports.claimHotspotTask = asyncHandler(async (req, res) => {
  const { hotspotId } = req.params;
  const groupId = req.body.group_id || null;
  const isAdmin = ADMIN_ROLES.includes(req.user.role);

  if (!isAdmin && req.user.volunteer_status !== 'verified') {
    throw ApiError.forbidden('Akun sukarelawan Anda masih menunggu verifikasi Admin sebelum dapat mengambil tugas lapangan.');
  }

  if (groupId && !(await isMember(groupId, req.user.id))) {
    throw ApiError.forbidden('Anda bukan anggota grup tersebut.');
  }

  const { data: hotspot } = await supabaseAdmin.from('hotspots').select('id, status').eq('id', hotspotId).maybeSingle();
  if (!hotspot || hotspot.status === 'resolved') {
    throw ApiError.badRequest('Titik lokasi tidak tersedia atau sudah selesai dibersihkan.');
  }

  const { data: activeTask } = await supabaseAdmin
    .from('cleanup_tasks')
    .select('id')
    .eq('hotspot_id', hotspotId)
    .in('status', ACTIVE_TASK_STATUSES)
    .limit(1)
    .maybeSingle();
  if (activeTask) throw ApiError.conflict('Titik ini sudah diambil oleh relawan lain.');

  const { data: task, error } = await supabaseAdmin
    .from('cleanup_tasks')
    .insert({ hotspot_id: hotspotId, volunteer_id: req.user.id, group_id: groupId, status: 'in_progress' })
    .select()
    .single();
  if (error) throw error;

  await supabaseAdmin.from('hotspots').update({ status: 'in_progress' }).eq('id', hotspotId);
  logActivity({ actorId: req.user.id, entityType: 'cleanup_task', entityId: task.id, action: 'task_claimed' });

  res.status(201).json({ success: true, task });
});

// Relawan mengirim bukti pembersihan
exports.completeTask = asyncHandler(async (req, res) => {
  const { taskId } = req.params;
  if (!req.file) throw ApiError.badRequest('Foto bukti area setelah dibersihkan wajib diunggah.');

  const { data: task } = await supabaseAdmin.from('cleanup_tasks').select('*').eq('id', taskId).maybeSingle();
  if (!task) throw ApiError.notFound('Tugas tidak ditemukan.');

  const owner = task.volunteer_id === req.user.id;
  if (!owner && !(task.group_id && (await isMember(task.group_id, req.user.id)))) {
    throw ApiError.forbidden('Tugas ini bukan milik Anda.');
  }
  if (task.status !== 'in_progress') {
    throw ApiError.conflict('Tugas ini tidak sedang dikerjakan, sehingga bukti tidak dapat dikirim.');
  }

  const { actual_weight_kg, completion_notes, notes } = req.body;
  const storagePath = await uploadPrivateImage(env.BUCKET_EVIDENCE, req.file.buffer, req.file.mimetype, req.user.id);

  const { data: updated, error } = await supabaseAdmin
    .from('cleanup_tasks')
    .update({
      status: 'submitted',
      proof_photo_path: storagePath,
      actual_weight_kg,
      completion_notes: completion_notes || notes || '',
      completed_at: new Date().toISOString()
    })
    .eq('id', taskId)
    .select()
    .single();

  if (error) {
    await removeFile(env.BUCKET_EVIDENCE, storagePath);
    throw error;
  }

  logActivity({ actorId: req.user.id, entityType: 'cleanup_task', entityId: taskId, action: 'task_submitted' });
  res.json({ success: true, message: 'Laporan pekerjaan berhasil dikirim dan menunggu verifikasi Admin.', task: updated });
});

// Komunitas: daftar relawan, grup kolaborasi, status keanggotaan & undangan masuk
exports.getCommunityData = asyncHandler(async (req, res) => {
  const userId = req.user.id;

  let volunteerQuery = supabaseAdmin
    .from('profiles')
    .select('id, full_name, age, phone, volunteer_status, completed_tasks_count, experience_points, volunteer_level')
    .eq('role', 'volunteer')
    .order('experience_points', { ascending: false });

  if (req.query.search) {
    volunteerQuery = volunteerQuery.ilike('full_name', `%${escapeLike(req.query.search)}%`);
  }

  const [{ data: volunteers }, { data: groups }, { data: invitations }] = await Promise.all([
    volunteerQuery,
    supabaseAdmin
      .from('volunteer_groups')
      .select(`
        *,
        creator:created_by (id, full_name, volunteer_level),
        volunteer_group_members (volunteer_id, role_in_group, profiles (id, full_name, volunteer_level))
      `)
      .order('created_at', { ascending: false }),
    supabaseAdmin
      .from('group_invitations')
      .select(`
        id, status, created_at,
        volunteer_groups (id, name, description),
        profiles!group_invitations_inviter_id_fkey (full_name)
      `)
      .eq('invitee_id', userId)
      .eq('status', 'pending')
      .order('created_at', { ascending: false })
  ]);

  const enrichedGroups = (groups || []).map((g) => {
    const membersList = g.volunteer_group_members || [];
    return {
      ...g,
      member_count: membersList.length,
      is_member: membersList.some((m) => m.volunteer_id === userId)
    };
  });

  const normalizedInvitations = (invitations || []).map((inv) => ({
    ...inv,
    collaboration_groups: inv.volunteer_groups
  }));

  res.json({
    success: true,
    volunteers: (volunteers || []).filter((v) => v.id !== userId),
    groups: enrichedGroups,
    invitations: normalizedInvitations
  });
});

exports.createCollaborationGroup = asyncHandler(async (req, res) => {
  const { name, description } = req.body;

  const { data: group, error } = await supabaseAdmin
    .from('volunteer_groups')
    .insert({ name, description, created_by: req.user.id })
    .select()
    .single();
  if (error) throw error;

  const { error: memberErr } = await supabaseAdmin
    .from('volunteer_group_members')
    .insert({ group_id: group.id, volunteer_id: req.user.id, role_in_group: 'leader' });
  if (memberErr) {
    await supabaseAdmin.from('volunteer_groups').delete().eq('id', group.id);
    throw memberErr;
  }

  res.status(201).json({
    success: true,
    group: { ...group, is_member: true, member_count: 1 }
  });
});

exports.joinCollaborationGroup = asyncHandler(async (req, res) => {
  const { groupId } = req.params;

  const { data: group } = await supabaseAdmin.from('volunteer_groups').select('id').eq('id', groupId).maybeSingle();
  if (!group) throw ApiError.notFound('Grup tidak ditemukan.');

  const { error } = await supabaseAdmin
    .from('volunteer_group_members')
    .upsert(
      { group_id: groupId, volunteer_id: req.user.id, role_in_group: 'member' },
      { onConflict: 'group_id,volunteer_id', ignoreDuplicates: true }
    );
  if (error) throw error;

  res.json({ success: true, message: 'Berhasil bergabung ke grup kolaborasi.' });
});

// Detail grup: daftar lengkap anggota + riwayat chat grup beserta lampiran lokasi sampah
exports.getGroupDetails = asyncHandler(async (req, res) => {
  const { groupId } = req.params;

  const [{ data: group, error: gErr }, { data: members }, { data: rawMessages, error: msgErr }] = await Promise.all([
    supabaseAdmin.from('volunteer_groups').select('*').eq('id', groupId).single(),
    supabaseAdmin
      .from('volunteer_group_members')
      .select('role_in_group, joined_at, profiles (id, full_name, volunteer_level, experience_points, completed_tasks_count, phone, age)')
      .eq('group_id', groupId)
      .order('joined_at', { ascending: true }),
    supabaseAdmin
      .from('group_messages')
      .select('*')
      .eq('group_id', groupId)
      .order('created_at', { ascending: true })
      .limit(100)
  ]);

  if (gErr || !group) {
    throw ApiError.notFound('Grup tidak ditemukan.');
  }
  if (msgErr) throw msgErr;

  const messages = await attachSendersAndHotspots(rawMessages || []);

  res.json({
    success: true,
    group,
    members: (members || []).map((m) => ({
      ...m.profiles,
      group_role: m.role_in_group,
      joined_at: m.joined_at
    })),
    messages
  });
});

// Kirim pesan ke obrolan grup (dapat melampirkan lokasi sampah untuk pengerjaan bareng)
exports.sendGroupMessage = asyncHandler(async (req, res) => {
  const { groupId } = req.params;
  const { content, hotspot_id } = req.body;

  if (!content?.trim() && !hotspot_id) {
    throw ApiError.badRequest('Pesan atau lokasi tidak boleh kosong.');
  }

  if (!(await isMember(groupId, req.user.id))) {
    throw ApiError.forbidden('Anda harus bergabung ke grup terlebih dahulu untuk mengirim pesan.');
  }

  const { data: inserted, error } = await supabaseAdmin
    .from('group_messages')
    .insert({
      group_id: groupId,
      sender_id: req.user.id,
      content: (content || '').trim(),
      hotspot_id: hotspot_id || null
    })
    .select('*')
    .single();

  if (error) throw error;
  const [message] = await attachSendersAndHotspots([inserted]);
  res.status(201).json({ success: true, message });
});

// Undang relawan ke dalam grup
exports.inviteToGroup = asyncHandler(async (req, res) => {
  const { groupId } = req.params;
  const { invitee_id } = req.body;

  if (!invitee_id) {
    throw ApiError.badRequest('Pilih relawan yang akan diundang.');
  }

  if (!(await isMember(groupId, req.user.id))) {
    throw ApiError.forbidden('Anda bukan anggota grup ini.');
  }

  if (await isMember(groupId, invitee_id)) {
    throw ApiError.badRequest('Relawan ini sudah tergabung di grup tersebut.');
  }

  const { error } = await supabaseAdmin
    .from('group_invitations')
    .upsert(
      {
        group_id: groupId,
        inviter_id: req.user.id,
        invitee_id,
        status: 'pending'
      },
      { onConflict: 'group_id,invitee_id' }
    );

  if (error) throw error;
  res.json({ success: true, message: 'Undangan bergabung ke grup berhasil dikirim!' });
});

// Terima atau tolak undangan grup
exports.respondGroupInvitation = asyncHandler(async (req, res) => {
  const { invitationId } = req.params;
  const { action } = req.body; // 'accept' | 'decline'

  const { data: inv, error: invErr } = await supabaseAdmin
    .from('group_invitations')
    .select('*')
    .eq('id', invitationId)
    .eq('invitee_id', req.user.id)
    .single();

  if (invErr || !inv) {
    throw ApiError.notFound('Undangan tidak ditemukan.');
  }

  if (action === 'accept') {
    await supabaseAdmin
      .from('volunteer_group_members')
      .upsert(
        { group_id: inv.group_id, volunteer_id: req.user.id, role_in_group: 'member' },
        { onConflict: 'group_id,volunteer_id', ignoreDuplicates: true }
      );

    await supabaseAdmin
      .from('group_invitations')
      .update({ status: 'accepted' })
      .eq('id', invitationId);

    return res.json({ success: true, message: 'Anda resmi bergabung ke grup!' });
  }

  await supabaseAdmin
    .from('group_invitations')
    .update({ status: 'declined' })
    .eq('id', invitationId);

  res.json({ success: true, message: 'Undangan ditolak.' });
});

// Ambil riwayat chat pribadi (DM) dengan relawan lain
exports.getDirectMessages = asyncHandler(async (req, res) => {
  const myId = req.user.id;
  const { peerId } = req.params;

  const { data: rawMessages, error } = await supabaseAdmin
    .from('direct_messages')
    .select('*')
    .or(`and(sender_id.eq.${myId},receiver_id.eq.${peerId}),and(sender_id.eq.${peerId},receiver_id.eq.${myId})`)
    .order('created_at', { ascending: true })
    .limit(100);

  if (error) throw error;
  const messages = await attachSendersAndHotspots(rawMessages || []);
  res.json({ success: true, messages });
});

// Kirim pesan pribadi (DM) ke relawan lain
exports.sendDirectMessage = asyncHandler(async (req, res) => {
  const myId = req.user.id;
  const { peerId } = req.params;
  const { content, hotspot_id } = req.body;

  if (!content?.trim() && !hotspot_id) {
    throw ApiError.badRequest('Pesan tidak boleh kosong.');
  }

  const { data: inserted, error } = await supabaseAdmin
    .from('direct_messages')
    .insert({
      sender_id: myId,
      receiver_id: peerId,
      content: (content || '').trim(),
      hotspot_id: hotspot_id || null
    })
    .select('*')
    .single();

  if (error) throw error;
  const [message] = await attachSendersAndHotspots([inserted]);
  res.status(201).json({ success: true, message });
});