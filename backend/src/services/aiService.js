const ai = require('../config/gemini');
const env = require('../config/env');
const { validateAiAnalysis } = require('../utils/aiValidator');
const ApiError = require('../utils/ApiError');

const SEVERITY_MAP = {
  low: { level: 'ringan', score: 30 },
  medium: { level: 'sedang', score: 55 },
  high: { level: 'parah', score: 85 },
  unknown: { level: 'sedang', score: 50 }
};

const PROMPT = `Kamu adalah AI Computer Vision untuk SirkulaAI, sistem pelaporan dan pemetaan hotspot sampah di lingkungan nyata.
Identifikasi sampah sekaligus tentukan apakah sampah tersebut benar-benar berada di lingkungan fisik atau hanya ditampilkan lewat media lain.

Kembalikan HANYA JSON valid dengan struktur:
{
  "waste_detected": true,
  "waste_categories": ["plastic"],
  "image_type": "real_photo",
  "waste_context": "physical_environment",
  "capture_validity": "valid",
  "description": "Deskripsi singkat objek yang terlihat",
  "distribution": "concentrated",
  "severity": "medium",
  "environmental_risk": [],
  "uncertainties": []
}

Nilai yang diizinkan:
- image_type: real_photo | illustration | screenshot | printed_image | unknown
- waste_context: physical_environment | device_screen | printed_surface | digital_content | unknown
- capture_validity: valid | invalid | uncertain
- waste_categories: plastic, paper_cardboard, organic, glass, metal, textile, e_waste, construction, hazardous, other, unknown
- distribution: concentrated | scattered | unknown
- severity: low | medium | high | unknown

Aturan:
1. Sampah terlihat nyata di jalan, sungai, tanah, selokan, atau lahan: image_type=real_photo, waste_context=physical_environment, capture_validity=valid.
2. Ilustrasi, gambar digital, screenshot, atau poster: capture_validity=invalid.
3. Kamera memotret layar HP/laptop/TV yang menampilkan sampah: image_type=real_photo, waste_context=device_screen, capture_validity=invalid.
4. Kamera memotret foto cetak/poster sampah: waste_context=printed_surface, capture_validity=invalid.
5. Konteks tidak pasti: gunakan unknown, capture_validity=uncertain, jelaskan di uncertainties.
6. Jangan menyatakan valid hanya karena ada sampah terlihat. Prioritaskan konteks keberadaan objek.
7. Jika waste_detected=false: waste_categories dan environmental_risk kosong, severity low atau unknown, distribution unknown.
8. Jangan mengarang berat atau volume. Severity dan risiko hanya perkiraan visual.`;

// Hasil palsu untuk demo / saat Gemini tidak tersedia. Selalu ditandai fallback: true
function mockAnalysis() {
  return {
    waste_detected: true,
    waste_categories: ['other'],
    image_type: 'real_photo',
    waste_context: 'physical_environment',
    capture_validity: 'valid',
    description: 'Tumpukan sampah terdeteksi di lokasi laporan (mode fallback, belum dianalisis AI).',
    distribution: 'unknown',
    severity: 'medium',
    environmental_risk: [],
    uncertainties: ['Hasil ini dibuat oleh mode fallback, bukan oleh model AI.'],
    fallback: true
  };
}

function statusOf(error) {
  const code = Number(error?.status || error?.code || error?.response?.status);
  if (code) return code;
  const msg = String(error?.message || '').toLowerCase();
  if (msg.includes('429') || msg.includes('resource_exhausted')) return 429;
  if (msg.includes('503') || msg.includes('unavailable') || msg.includes('overloaded')) return 503;
  return 500;
}

async function callGemini(buffer, mimeType) {
  const response = await ai.models.generateContent({
    model: env.GEMINI_MODEL,
    contents: [PROMPT, { inlineData: { data: buffer.toString('base64'), mimeType } }],
    config: { responseMimeType: 'application/json' }
  });

  const text = (response.text || '').replace(/```json|```/gi, '').trim();
  const parsed = JSON.parse(text);

  const validation = validateAiAnalysis(parsed);
  if (!validation.valid) {
    throw new Error(`Format hasil AI tidak sesuai: ${validation.errors.join('; ')}`);
  }
  return { raw: parsed, validation };
}

/**
 * Analisis foto sampah.
 * Mengembalikan objek siap pakai untuk reportController:
 *   has_waste, is_valid_capture, needs_admin_review, severity_level, impact_score, description, ai: {...}
 */
async function analyzeWasteImage(buffer, mimeType) {
  let raw;
  let validation;
  let fallback = false;

  try {
    if (!ai) throw new Error('GEMINI_API_KEY belum diisi.');
    ({ raw, validation } = await callGemini(buffer, mimeType));
  } catch (err) {
    const status = statusOf(err);
    console.warn(`[ai] Gemini gagal (${status}): ${err.message}`);

    if (env.AI_FALLBACK_MODE === 'error') {
      throw status === 429
        ? new ApiError(429, 'Layanan AI sedang mencapai batas permintaan. Coba lagi beberapa saat.')
        : ApiError.unavailable('Layanan analisis AI sedang tidak tersedia. Silakan coba lagi.');
    }

    raw = mockAnalysis();
    validation = validateAiAnalysis(raw);
    fallback = true;
  }

  const severity = SEVERITY_MAP[raw.severity] || SEVERITY_MAP.medium;
  const eligible = validation.report_eligible && raw.waste_detected;
  const needsReview = !eligible && validation.review_required && raw.waste_detected;

  return {
    has_waste: raw.waste_detected,
    is_valid_capture: eligible || needsReview,
    needs_admin_review: needsReview,
    severity_level: severity.level,
    impact_score: severity.score,
    description: raw.description,
    fallback,
    detail: {
      categories: raw.waste_categories,
      image_type: raw.image_type,
      waste_context: raw.waste_context,
      capture_validity: raw.capture_validity,
      distribution: raw.distribution,
      environmental_risk: raw.environmental_risk,
      uncertainties: raw.uncertainties
    }
  };
}

module.exports = { analyzeWasteImage };
