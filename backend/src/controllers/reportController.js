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

  // Hitung ulang tingkat keparahan hotspot berdasarkan seluruh foto dari berbagai sudut & jarak
  async function recalculateHotspotSeverity(hotspotId) {
    const { data: reports, error } = await supabaseAdmin
      .from('reports')
      .select('id, latitude, longitude, severity_level, impact_score, created_at')
      .eq('hotspot_id', hotspotId)
      .neq('status', 'rejected');

    if (error || !reports || reports.length === 0) return null;

    const fallbackScoreMap = {
      low: 25,
      medium: 50,
      high: 75,
      critical: 95
    };

    let maxPhotoScore = 0;
    let totalScore = 0;

    for (const r of reports) {
      const score = Number(r.impact_score) || fallbackScoreMap[r.severity_level] || 25;
      if (score > maxPhotoScore) maxPhotoScore = score;
      totalScore += score;
    }

    const avgPhotoScore = totalScore / reports.length;

    // Hitung sebaran jarak terjauh antar sudut foto pada lokasi yang sama
    let maxSpreadMeters = 0;
    for (let i = 0; i < reports.length; i++) {
      for (let j = i + 1; j < reports.length; j++) {
        const dist = calculateDistanceMeters(
          reports[i].latitude,
          reports[i].longitude,
          reports[j].latitude,
          reports[j].longitude
        );
        if (dist > maxSpreadMeters) maxSpreadMeters = dist;
      }
    }

    // Formula Gabungan Multi-Sudut:
    // - 60% dari titik terparah (menjaga bobot tumpukan utama di bawah pohon)
    // - 25% dari rata-rata kepadatan seluruh sudut foto
    // - Bonus jumlah sudut foto (+5 per foto tambahan, maks +15) & bonus sebaran area (>=8m = +5)
    const angleBonus = Math.min((reports.length - 1) * 5, 15);
    const spreadBonus = maxSpreadMeters >= 8 ? 5 : 0;

    const combinedScore = Math.min(
      100,
      Math.round(maxPhotoScore * 0.6 + avgPhotoScore * 0.25 + angleBonus + spreadBonus)
    );

    let priorityLevel = 'low';
    if (combinedScore >= 80) priorityLevel = 'critical';
    else if (combinedScore >= 60) priorityLevel = 'high';
    else if (combinedScore >= 38) priorityLevel = 'medium';

    const { data: updatedHotspot } = await supabaseAdmin
      .from('hotspots')
      .update({
        priority_level: priorityLevel,
        priority_score: combinedScore,
        last_verified_at: new Date().toISOString()
      })
      .eq('id', hotspotId)
      .select('id, title, latitude, longitude, priority_score, priority_level')
      .single();

    return updatedHotspot;
  }

  exports.createReport = asyncHandler(async (req, res) => {
    const file = req.file;
    if (!file) throw ApiError.badRequest('Foto bukti wajib diambil langsung dari kamera.');

    const latitude = parseFloat(req.body.latitude);
    const longitude = parseFloat(req.body.longitude);
    const { gps_accuracy_m, location_captured_at, description } = req.body;
    const capturedAt = location_captured_at || new Date().toISOString();

    // 1. Analisis AI (Gemini utama, otomatis fallback ke model lokal best.onnx jika error/kuota habis)
    const ai = await analyzeWasteImage(file.buffer, file.mimetype, file.originalname);

    if (!ai.is_valid_capture) {
      return res.status(200).json({
        success: true,
        rejected_by_ai: true,
        reason: ai.description || 'Foto tidak valid atau tidak ditemukan tumpukan sampah.'
      });
    }

    // 2. Cari hotspot terdekat dalam radius 30m
    const { data: activeHotspots } = await supabaseAdmin
      .from('hotspots')
      .select('id, title, latitude, longitude, priority_score, priority_level')
      .neq('status', 'resolved');
    const matched = findNearestHotspot(activeHotspots || [], latitude, longitude);
    const { hotspot, distance } = matched;

    // 3. Simpan foto, lalu laporan. Jika langkah berikutnya gagal, foto dibersihkan.
    const folder = req.user?.id || 'guest-public';
    const storagePath = await uploadPrivateImage(env.BUCKET_REPORTS, file.buffer, file.mimetype, folder);

    try {
      const status = hotspot ? 'verified' : 'analysis_completed';

      // Simpan koordinat asli sudut pengambilan foto agar jarak sebaran multi-foto dapat dihitung
      const { data: report, error: reportErr } = await supabaseAdmin
        .from('reports')
        .insert({
          reporter_id: req.user?.id || null,
          hotspot_id: hotspot ? hotspot.id : null,
          latitude,
          longitude,
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

      // 4. Gabungkan seluruh data foto di titik lokasi ini untuk memperbarui tingkat keparahan wilayah
      let updatedHotspot = hotspot;
      if (hotspot) {
        updatedHotspot = (await recalculateHotspotSeverity(hotspot.id)) || hotspot;
      }

      res.status(201).json({
        success: true,
        report,
        merged_location: Boolean(hotspot),
        matched_hotspot: updatedHotspot,
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