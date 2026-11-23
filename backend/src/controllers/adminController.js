const { supabaseAdmin } = require('../config/supabase');
const env = require('../config/env');
const { getSignedImageUrl } = require('../services/storageService');
const { createAdminAccount } = require('../services/authService');
const { logActivity } = require('../services/auditService');
const { xpForSeverity, computeVolunteerLevel } = require('../utils/volunteerLevel');
const asyncHandler = require('../utils/asyncHandler');
const ApiError = require('../utils/ApiError');

const DEFAULT_SCORE = { ringan: 30, sedang: 55, parah: 85 };

// ---------- Laporan warga ----------
exports.getAllReports = asyncHandler(async (req, res) => {
  let query = supabaseAdmin
    .from('reports')
    .select('*, report_images (storage_path)')
    .order('created_at', { ascending: false })
    .limit(500);
  if (req.query.status) query = query.eq('status', req.query.status);

  const { data, error } = await query;
  if (error) throw error;

  const reports = await Promise.all(
    (data || []).map(async (r) => ({
      ...r,
      photo_url: await getSignedImageUrl(env.BUCKET_REPORTS, r.report_images?.[0]?.storage_path)
    }))
  );
  res.json({ success: true, reports });
});

// Admin memverifikasi lokasi dan menetapkan tingkat keparahan
exports.verifyReportAndImpact = asyncHandler(async (req, res) => {
  const { id } = req.params;
  const { approved, title, severity_level, impact_score, primary_category } = req.body;

  const { data: report } = await supabaseAdmin.from('reports').select('*').eq('id', id).maybeSingle();
  if (!report) throw ApiError.notFound('Laporan tidak ditemukan.');
  if (['verified', 'rejected'].includes(report.status)) {
    throw ApiError.conflict('Laporan ini sudah diproses sebelumnya.');
  }

  if (!approved) {
    await supabaseAdmin.from('reports').update({ status: 'rejected' }).eq('id', id);
    logActivity({ actorId: req.user.id, entityType: 'report', entityId: id, action: 'report_rejected' });
    return res.json({ success: true, message: 'Laporan ditolak.' });
  }

  const severity = severity_level || report.severity_level || 'sedang';
  const score = impact_score ?? DEFAULT_SCORE[severity] ?? 55;

  const { data: hotspot, error: hsErr } = await supabaseAdmin
    .from('hotspots')
    .insert({
      title: title || `Titik Sampah (${severity.toUpperCase()})`,
      latitude: report.latitude,
      longitude: report.longitude,
      severity,
      priority_level: severity,
      priority_score: score,
      primary_category: primary_category || 'Campuran',
      status: 'open',
      last_verified_at: new Date().toISOString()
    })
    .select()
    .single();
  if (hsErr) throw hsErr;

  const { error: updErr } = await supabaseAdmin
    .from('reports')
    .update({ status: 'verified', hotspot_id: hotspot.id, severity_level: severity, impact_score: score })
    .eq('id', id);
  if (updErr) {
    await supabaseAdmin.from('hotspots').delete().eq('id', hotspot.id); // jangan tinggalkan hotspot yatim
    throw updErr;
  }

  logActivity({ actorId: req.user.id, entityType: 'report', entityId: id, action: 'report_verified', details: { hotspot_id: hotspot.id } });
  res.json({ success: true, message: 'Lokasi terverifikasi dan diterbitkan ke peta.', hotspot });
});

// ---------- Relawan ----------
exports.getVolunteers = asyncHandler(async (_req, res) => {
  const { data, error } = await supabaseAdmin
    .from('profiles')
    .select('*')
    .eq('role', 'volunteer')
    .order('created_at', { ascending: false });
  if (error) throw error;

  const volunteers = (data || []).map((v) => {
    const phone = (v.phone || '').replace(/[^0-9]/g, '').replace(/^0/, '62');
    return { ...v, whatsapp_url: phone ? `https://wa.me/${phone}` : null };
  });
  res.json({ success: true, volunteers });
});

exports.verifyVolunteerAccount = asyncHandler(async (req, res) => {
  const { id } = req.params;
  const { status } = req.body;

  const { data, error } = await supabaseAdmin
    .from('profiles')
    .update({ volunteer_status: status, is_active: status === 'verified' })
    .eq('id', id)
    .eq('role', 'volunteer') // hanya akun relawan yang boleh diubah lewat endpoint ini
    .select()
    .maybeSingle();
  if (error) throw error;
  if (!data) throw ApiError.notFound('Relawan tidak ditemukan.');

  logActivity({ actorId: req.user.id, entityType: 'profile', entityId: id, action: `volunteer_${status}` });
  res.json({ success: true, volunteer: data });
});

// ---------- Tugas pembersihan ----------
exports.getSubmittedTasks = asyncHandler(async (_req, res) => {
  const { data, error } = await supabaseAdmin
    .from('cleanup_tasks')
    .select(`
      *,
      hotspots (id, title, priority_level, priority_score),
      profiles:volunteer_id (id, full_name, phone, volunteer_level),
      volunteer_groups (id, name)
    `)
    .order('created_at', { ascending: false })
    .limit(500);
  if (error) throw error;

  const tasks = await Promise.all(
    (data || []).map(async (t) => ({
      ...t,
      proof_photo_url: await getSignedImageUrl(env.BUCKET_EVIDENCE, t.proof_photo_path)
    }))
  );
  res.json({ success: true, tasks });
});

// Setujui tugas -> hitung XP, naikkan level, tandai hotspot selesai
exports.approveVolunteerTask = asyncHandler(async (req, res) => {
  const { taskId } = req.params;
  const { approved, review_notes } = req.body;

  const { data: task } = await supabaseAdmin
    .from('cleanup_tasks')
    .select('*, hotspots (id, priority_level)')
    .eq('id', taskId)
    .maybeSingle();
  if (!task) throw ApiError.notFound('Tugas tidak ditemukan.');
  // Mencegah XP ganda jika tombol setuju ditekan berulang
  if (task.status !== 'submitted') {
    throw ApiError.conflict('Hanya tugas yang sudah dikirim relawan yang dapat diverifikasi.');
  }

  if (!approved) {
    await supabaseAdmin
      .from('cleanup_tasks')
      .update({ status: 'in_progress', admin_review_notes: review_notes || 'Perlu bukti foto ulang.' })
      .eq('id', taskId);
    logActivity({ actorId: req.user.id, entityType: 'cleanup_task', entityId: taskId, action: 'task_returned' });
    return res.json({ success: true, message: 'Laporan dikembalikan ke relawan untuk diperbaiki.' });
  }

  const xp = xpForSeverity(task.hotspots?.priority_level);

  const { error: taskErr } = await supabaseAdmin
    .from('cleanup_tasks')
    .update({ status: 'approved', xp_awarded: xp, admin_review_notes: review_notes || 'Pekerjaan terverifikasi selesai.' })
    .eq('id', taskId);
  if (taskErr) throw taskErr;

  if (task.hotspot_id) {
    await supabaseAdmin.from('hotspots').update({ status: 'resolved' }).eq('id', task.hotspot_id);
  }

  // Semua relawan yang terlibat (individu atau seluruh anggota grup) mendapat XP
  let participantIds = [task.volunteer_id];
  if (task.group_id) {
    const { data: members } = await supabaseAdmin
      .from('volunteer_group_members')
      .select('volunteer_id')
      .eq('group_id', task.group_id);
    if (members?.length) participantIds = [...new Set(members.map((m) => m.volunteer_id))];
  }

  await Promise.all(
    participantIds.map(async (volId) => {
      const { data: vol } = await supabaseAdmin
        .from('profiles')
        .select('completed_tasks_count, experience_points')
        .eq('id', volId)
        .maybeSingle();
      if (!vol) return;

      const newXp = (vol.experience_points || 0) + xp;
      await supabaseAdmin
        .from('profiles')
        .update({
          completed_tasks_count: (vol.completed_tasks_count || 0) + 1,
          experience_points: newXp,
          volunteer_level: computeVolunteerLevel(newXp)
        })
        .eq('id', volId);
    })
  );

  logActivity({ actorId: req.user.id, entityType: 'cleanup_task', entityId: taskId, action: 'task_approved', details: { xp } });
  res.json({ success: true, message: `Pekerjaan relawan diverifikasi (+${xp} XP). Titik peta ditandai selesai.` });
});

// ---------- Akun admin ----------
exports.createNewAdmin = asyncHandler(async (req, res) => {
  const admin = await createAdminAccount(req.body, req.user.id);
  res.status(201).json({ success: true, message: `Akun Admin baru (${admin.email}) berhasil dibuat.`, admin });
});
