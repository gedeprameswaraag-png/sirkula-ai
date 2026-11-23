const hotspotService = require('../services/hotspotService');
const authService = require('../services/authService');
const asyncHandler = require('../utils/asyncHandler');

exports.getPublicHotspots = asyncHandler(async (req, res) => {
  const hotspots = await hotspotService.getPublicHotspots({
    priorityLevel: req.query.priority_level,
    category: req.query.category
  });
  res.json({ success: true, hotspots });
});

exports.getImpactStats = asyncHandler(async (_req, res) => {
  const stats = await hotspotService.getImpactStats();
  res.json({ success: true, stats });
});

// Handler pendaftaran relawan baru dengan verifikasi email asli
exports.registerVolunteer = asyncHandler(async (req, res) => {
  const result = await authService.registerVolunteer(req.body);
  res.status(201).json({
    success: true,
    message: `Tautan verifikasi telah dikirim ke ${result.email}. Silakan buka kotak masuk/spam email Anda dan klik tautan verifikasi sebelum login.`,
    ...result
  });
});