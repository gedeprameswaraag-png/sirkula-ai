const { z } = require('zod');

const createReportSchema = z.object({
  latitude: z.coerce.number().min(-90).max(90, 'Koordinat GPS tidak valid.'),
  longitude: z.coerce.number().min(-180).max(180, 'Koordinat GPS tidak valid.'),
  gps_accuracy_m: z.coerce.number().min(0).max(100000).optional().default(20),
  location_captured_at: z.string().datetime({ offset: true }).optional(),
  description: z.string().trim().max(500).optional(),
  capture_source: z.literal('camera', {
    errorMap: () => ({ message: 'Foto wajib diambil langsung menggunakan kamera perangkat.' })
  })
});

module.exports = { createReportSchema };
