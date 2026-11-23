
const { supabaseAdmin } = require('../config/supabase');
const env = require('../config/env');
const {
  uploadPrivateImage,
  removeFile,
  getSignedImageUrl
} = require('../services/storageService');
const { analyzeWasteImage } = require('../services/aiService');
const asyncHandler = require('../utils/asyncHandler');
const ApiError = require('../utils/ApiError');

function buildFallbackAIResult(error) {
  return {
    source: 'unavailable',
    capture_category: 'review_required',
    is_valid_capture: false,
    is_clean_location: false,
    needs_admin_review: true,
    severity_level: 'low',
    impact_score: 0,
    description: 'Analisis AI belum dapat dilakukan. Laporan menunggu pemeriksaan admin.',
    error_message: error?.message || 'AI service unavailable'
  };
}

function createReportTitle(description, aiDescription) {
  const source = String(description || aiDescription || '').trim();

  if (!source) return 'Laporan sampah baru';

  return source.length > 120
    ? `${source.slice(0, 117)}...`
    : source;
}

exports.createReport = asyncHandler(async (req, res) => {
  const file = req.file;

  if (!file) {
    throw ApiError.badRequest(
      'Foto bukti wajib diambil langsung dari kamera.'
    );
  }

  const latitude = Number(req.body.latitude);
  const longitude = Number(req.body.longitude);

  if (
    !Number.isFinite(latitude) ||
    latitude < -90 ||
    latitude > 90 ||
    !Number.isFinite(longitude) ||
    longitude < -180 ||
    longitude > 180
  ) {
    throw ApiError.badRequest('Koordinat GPS tidak valid.');
  }

  const description = String(req.body.description || '').trim();
  const capturedAt = req.body.location_captured_at || new Date().toISOString();

  // 1. Simpan foto terlebih dahulu.
  // Laporan tetap bisa disimpan meskipun layanan AI sedang tidak tersedia.
  const folder = req.user?.id || 'guest-public';

  const storagePath = await uploadPrivateImage(
    env.BUCKET_REPORTS,
    file.buffer,
    file.mimetype,
    folder
  );

  try {
    // 2. Jalankan AI. Jika gagal, laporan tetap dilanjutkan sebagai pending.
    let ai;

    try {
      ai = await analyzeWasteImage(
        file.buffer,
        file.mimetype,
        file.originalname
      );
    } catch (aiError) {
      console.error('[Report] Analisis AI gagal:', aiError.message);
      ai = buildFallbackAIResult(aiError);
    }

    // 3. Semua laporan baru menunggu pemeriksaan admin.
    // Tidak membuat atau menggabungkan hotspot secara otomatis.
    const reportTitle = createReportTitle(
      description,
      ai.description
    );

    const aiIsValidWaste =
      ai.source === 'unavailable' || ai.needs_admin_review
        ? null
        : ai.capture_category === 'waste_detected';

    const aiSeverity = [
      'low',
      'medium',
      'high',
      'critical'
    ].includes(ai.severity_level)
      ? ai.severity_level
      : 'low';

    const { data: report, error: reportError } = await supabaseAdmin
      .from('reports')
      .insert({
        reporter_id: req.user?.id || null,
        hotspot_id: null,
        title: reportTitle,
        description: description || ai.description || null,
        latitude,
        longitude,
        photo_path: storagePath,
        ai_is_valid_waste: aiIsValidWaste,
        ai_waste_types: [],
        ai_severity: aiSeverity,
        ai_estimated_weight_kg: 0,
        ai_summary: ai.description || 'Menunggu pemeriksaan admin.',
        status: 'pending'
      })
      .select()
      .single();

    if (reportError) {
      throw reportError;
    }

    // 4. Berikan URL foto sementara kepada frontend.
    const photoUrl = await getSignedImageUrl(
      env.BUCKET_REPORTS,
      storagePath
    );

    return res.status(201).json({
      success: true,
      message: 'Laporan berhasil dikirim dan menunggu pemeriksaan admin.',
      report: {
        ...report,
        photo_url: photoUrl
      },
      ai: {
        source: ai.source,
        capture_category: ai.capture_category,
        is_valid_capture: ai.is_valid_capture,
        needs_admin_review: ai.needs_admin_review,
        severity_level: ai.severity_level,
        impact_score: ai.impact_score,
        description: ai.description
      },
      needs_review: true,
      merged_location: false,
      matched_hotspot: null
    });
  } catch (error) {
    // Hapus foto jika penyimpanan laporan gagal.
    await removeFile(env.BUCKET_REPORTS, storagePath);
    throw error;
  }
});

exports.getMyReports = asyncHandler(async (req, res) => {
  const { data, error } = await supabaseAdmin
    .from('reports')
    .select('*')
    .eq('reporter_id', req.user.id)
    .order('created_at', { ascending: false });

  if (error) throw error;

  const reports = await Promise.all(
    (data || []).map(async (report) => ({
      ...report,
      photo_url: report.photo_path
        ? await getSignedImageUrl(
            env.BUCKET_REPORTS,
            report.photo_path
          )
        : null
    }))
  );

  return res.json({
    success: true,
    reports
  });
});
