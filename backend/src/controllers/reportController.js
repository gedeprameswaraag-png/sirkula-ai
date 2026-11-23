const { supabaseAdmin } = require('../config/supabase');
const env = require('../config/env');
const { uploadPrivateImage, removeFile, getSignedImageUrl } = require('../services/storageService');
const { analyzeWasteImage } = require('../services/aiService');
const { calculateDistanceMeters } = require('../utils/geoUtils');
const asyncHandler = require('../utils/asyncHandler');
const ApiError = require('../utils/ApiError');

const MERGE_RADIUS_M = 30; // laporan sedekat ini otomatis ditautkan ke hotspot aktif

function findNearestHotspot(hotspots, lat, lng) {
  let best = null;
  let bestDistance = Infinity;
  for (const hs of hotspots) {
    const d = calculateDistanceMeters(lat, lng, hs.latitude, hs.longitude);
    if (d <= MERGE_RADIUS_M && d < bestDistance) {
      best = hs;
      bestDistance = d;
    }
  }
  return { hotspot: best, distance: bestDistance };
}

exports.createReport = asyncHandler(async (req, res) => {
  const file = req.file;
  if (!file) throw ApiError.badRequest('Foto bukti wajib diambil langsung dari kamera.');

  const { latitude, longitude, gps_accuracy_m, location_captured_at, description } = req.body;
  const capturedAt = location_captured_at || new Date().toISOString();

  // 1. Analisis AI (keaslian foto, ada tidaknya sampah, tingkat keparahan)
  const ai = await analyzeWasteImage(file.buffer, file.mimetype);

  if (!ai.is_valid_capture) {
    return res.status(200).json({
      success: true,
      rejected_by_ai: true,
      reason: ai.description || 'Foto tidak valid atau tidak ditemukan tumpukan sampah.'
    });
  }

  // 2. Foto yang meragukan tidak digabung otomatis; menunggu verifikasi admin
  let matched = { hotspot: null, distance: null };
  if (!ai.needs_admin_review) {
    const { data: activeHotspots } = await supabaseAdmin
      .from('hotspots')
      .select('id, title, latitude, longitude, priority_score, priority_level')
      .neq('status', 'resolved');
    matched = findNearestHotspot(activeHotspots || [], latitude, longitude);
  }
  const { hotspot, distance } = matched;

  // 3. Simpan foto, lalu laporan. Jika langkah berikutnya gagal, foto dibersihkan.
  const folder = req.user?.id || 'guest-public';
  const storagePath = await uploadPrivateImage(env.BUCKET_REPORTS, file.buffer, file.mimetype, folder);

  try {
    const status = ai.needs_admin_review ? 'needs_review' : hotspot ? 'verified' : 'analysis_completed';

    const { data: report, error: reportErr } = await supabaseAdmin
      .from('reports')
      .insert({
        reporter_id: req.user?.id || null,
        hotspot_id: hotspot ? hotspot.id : null,
        latitude: hotspot ? hotspot.latitude : latitude,
        longitude: hotspot ? hotspot.longitude : longitude,
        gps_accuracy_m,
        location_captured_at: capturedAt,
        description: description || ai.description,
        severity_level: ai.severity_level,
        impact_score: ai.impact_score,
        status
      })
      .select()
      .single();
    if (reportErr) throw reportErr;

    const { error: imageErr } = await supabaseAdmin.from('report_images').insert({
      report_id: report.id,
      storage_path: storagePath,
      mime_type: file.mimetype,
      size_bytes: file.size,
      captured_at: capturedAt
    });
    if (imageErr) {
      await supabaseAdmin.from('reports').delete().eq('id', report.id);
      throw imageErr;
    }

    if (hotspot) {
      await supabaseAdmin
        .from('hotspots')
        .update({ last_verified_at: new Date().toISOString() })
        .eq('id', hotspot.id);
    }

    res.status(201).json({
      success: true,
      report,
      merged_location: Boolean(hotspot),
      matched_hotspot: hotspot,
      distance_m: hotspot ? Math.round(distance) : null,
      needs_review: ai.needs_admin_review,
      ai
    });
  } catch (err) {
    await removeFile(env.BUCKET_REPORTS, storagePath);
    throw err;
  }
});

exports.getMyReports = asyncHandler(async (req, res) => {
  const { data, error } = await supabaseAdmin
    .from('reports')
    .select('*, report_images (storage_path)')
    .eq('reporter_id', req.user.id)
    .order('created_at', { ascending: false });
  if (error) throw error;

  const reports = await Promise.all(
    data.map(async (item) => ({
      ...item,
      photo_url: await getSignedImageUrl(env.BUCKET_REPORTS, item.report_images?.[0]?.storage_path)
    }))
  );
  res.json({ success: true, reports });
});
