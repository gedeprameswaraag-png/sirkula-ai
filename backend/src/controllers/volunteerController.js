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

// Komunitas: daftar relawan (tanpa riwayat penyakit) dan grup kolaborasi
exports.getCommunityData = asyncHandler(async (req, res) => {
  let volunteerQuery = supabaseAdmin
    .from('profiles')
    .select('id, full_name, age, volunteer_status, completed_tasks_count, experience_points, volunteer_level')
    .eq('role', 'volunteer')
    .eq('is_active', true)
    .order('experience_points', { ascending: false });

  if (req.query.search) {
    volunteerQuery = volunteerQuery.ilike('full_name', `%${escapeLike(req.query.search)}%`);
  }

  const [{ data: volunteers }, { data: groups }] = await Promise.all([
    volunteerQuery,
    supabaseAdmin
      .from('volunteer_groups')
      .select(`
        *,
        creator:created_by (id, full_name, volunteer_level),
        volunteer_group_members (volunteer_id, role_in_group, profiles (id, full_name, volunteer_level))
      `)
      .order('created_at', { ascending: false })
  ]);

  res.json({ success: true, volunteers: volunteers || [], groups: groups || [] });
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

  res.status(201).json({ success: true, group });
});

exports.joinCollaborationGroup = asyncHandler(async (req, res) => {
  const { groupId } = req.params;

  const { data: group } = await supabaseAdmin.from('volunteer_groups').select('id').eq('id', groupId).maybeSingle();
  if (!group) throw ApiError.notFound('Grup tidak ditemukan.');

  const { error } = await supabaseAdmin
    .from('volunteer_group_members')
    .upsert(
      { group_id: groupId, volunteer_id: req.user.id, role_in_group: 'member' },
      { onConflict: 'group_id,volunteer_id', ignoreDuplicates: true } // tidak menurunkan leader menjadi member
    );
  if (error) throw error;

  res.json({ success: true, message: 'Berhasil bergabung ke grup kolaborasi.' });
});
