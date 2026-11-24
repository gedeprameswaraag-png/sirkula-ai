const { GoogleGenAI } = require('@google/genai');
const env = require('../config/env');

// ONNX hanya aktif jika LOCAL_AI_URL diisi eksplisit (tidak untuk Vercel).
const LOCAL_AI_URL = (env.LOCAL_AI_URL || process.env.LOCAL_AI_URL || '').trim();

const LOCAL_AI_TIMEOUT_MS = Number(
  process.env.LOCAL_AI_TIMEOUT_MS || 30000
);

const PRIMARY_GEMINI_MODEL = (
  env.GEMINI_MODEL ||
  process.env.GEMINI_MODEL ||
  'gemini-3.5-flash-lite'
).trim();

// Daftar model cadangan otomatis jika model utama 404 NOT_FOUND
const GEMINI_CANDIDATE_MODELS = [
  ...new Set([
    PRIMARY_GEMINI_MODEL,
    'gemini-3.5-flash-lite',
    'gemini-3-flash-preview',
    'gemini-2.5-flash-lite'
  ])
];

const RETRYABLE_STATUS = [429, 500, 502, 503, 504];

const VALID_CATEGORIES = [
  'invalid_photo',
  'clean_location',
  'waste_detected',
  'review_required'
];

let geminiClient = null;
let cachedApiKey = null;

function getGeminiClient() {
  const apiKey = (env.GEMINI_API_KEY || process.env.GEMINI_API_KEY || '').trim();

  if (!apiKey) {
    throw new Error('GEMINI_API_KEY tidak dikonfigurasi di environment variables.');
  }

  if (!geminiClient || cachedApiKey !== apiKey) {
    geminiClient = new GoogleGenAI({ apiKey });
    cachedApiKey = apiKey;
  }

  return geminiClient;
}

function sleep(ms) {
  return new Promise((resolve) => setTimeout(resolve, ms));
}

function clampScore(value, min = 0, max = 100) {
  const number = Number(value);
  if (!Number.isFinite(number)) return min;
  return Math.min(max, Math.max(min, Math.round(number)));
}

function normalizeSeverity(rawLevel, score = 30) {
  const value = String(rawLevel || '').toLowerCase().trim();

  if (['critical', 'kritis', 'sangat_parah', 'sangat parah'].includes(value)) return 'critical';
  if (['high', 'tinggi', 'parah', 'berat'].includes(value)) return 'high';
  if (['medium', 'sedang', 'menengah'].includes(value)) return 'medium';
  if (['low', 'rendah', 'ringan'].includes(value)) return 'low';

  if (score >= 80) return 'critical';
  if (score >= 60) return 'high';
  if (score >= 38) return 'medium';
  return 'low';
}

function invalidPhotoResult(description, source = 'ai') {
  return {
    source,
    capture_category: 'invalid_photo',
    is_valid_capture: false,
    is_clean_location: false,
    needs_admin_review: true,
    severity_level: 'low',
    impact_score: 0,
    description
  };
}

function cleanLocationResult(description, source = 'ai') {
  return {
    source,
    capture_category: 'clean_location',
    is_valid_capture: true,
    is_clean_location: true,
    needs_admin_review: true,
    severity_level: 'low',
    impact_score: 0,
    description
  };
}

function reviewRequiredResult(description, source = 'ai') {
  return {
    source,
    capture_category: 'review_required',
    is_valid_capture: false,
    is_clean_location: false,
    needs_admin_review: true,
    severity_level: 'low',
    impact_score: 0,
    description
  };
}

function computeLocalImpactScore(data) {
  const level = String(data.level || '').toLowerCase();
  const areaM2 = Number(data.luas_sampah_m2 || 0);
  const pileAreaM2 = Number(data.luas_tumpukan_m2 || 0);
  const count = Number(data.jumlah_objek || 0);

  let base = 28;
  if (level === 'berat') base = 75;
  else if (level === 'sedang') base = 50;

  const areaBonus = Math.min(18, Math.round(areaM2 * 4 + pileAreaM2 * 5));
  const countBonus = Math.min(7, Math.floor(count / 3));

  return clampScore(base + areaBonus + countBonus, 15, 100);
}

function parseJsonResponse(text) {
  const cleaned = String(text || '')
    .replace(/^\s*```(?:json)?/i, '')
    .replace(/```\s*$/i, '')
    .trim();

  return JSON.parse(cleaned);
}

// =====================================================
// 1. FALLBACK: MODEL LOKAL ONNX MELALUI PYTHON FASTAPI
// =====================================================

async function analyzeWithLocalModel(
  fileBuffer,
  mimeType,
  filename = 'waste.jpg'
) {
  if (!LOCAL_AI_URL) {
    throw new Error('LOCAL_AI_URL tidak diisi, fallback ONNX dinonaktifkan.');
  }

  const formData = new FormData();
  const blob = new Blob([fileBuffer], { type: mimeType || 'image/jpeg' });
  formData.append('foto', blob, filename);

  const controller = new AbortController();
  const timeout = setTimeout(() => controller.abort(), LOCAL_AI_TIMEOUT_MS);

  let response;
  try {
    response = await fetch(LOCAL_AI_URL, {
      method: 'POST',
      body: formData,
      signal: controller.signal
    });
  } catch (error) {
    if (error.name === 'AbortError') {
      throw new Error('Python AI timeout.');
    }
    throw new Error(`Python AI tidak dapat dihubungi: ${error.message}`);
  } finally {
    clearTimeout(timeout);
  }

  if (!response.ok) {
    const errorText = await response.text().catch(() => '');
    throw new Error(`Local AI error (${response.status}): ${errorText}`);
  }

  const data = await response.json();
  const status = String(data.status || '').toLowerCase();
  const jumlahObjek = Number(data.jumlah_objek || 0);
  const alasanList = Array.isArray(data.alasan) ? data.alasan : [];
  const objekList = Array.isArray(data.objek) ? data.objek : [];

  const maxConf = objekList.length > 0
    ? Math.max(...objekList.map((obj) => Number(obj.confidence || 0)))
    : 0;

  if (status === 'foto_ulang') {
    return invalidPhotoResult(
      alasanList[0] || 'Foto tidak jelas. Silakan ambil foto ulang.',
      'local_onnx'
    );
  }

  if (jumlahObjek === 0) {
    return cleanLocationResult(
      'Model lokal tidak menemukan objek sampah. Laporan tetap menunggu pemeriksaan admin.',
      'local_onnx'
    );
  }

  const lowConfidence =
    alasanList.some((reason) =>
      String(reason).toLowerCase().includes('keyakinan model rendah')
    ) ||
    !Number.isFinite(maxConf) ||
    maxConf < 0.55;

  if (lowConfidence) {
    return reviewRequiredResult(
      'Objek pada foto belum cukup jelas untuk divalidasi. Perlu pemeriksaan admin.',
      'local_onnx'
    );
  }

  const impactScore = computeLocalImpactScore(data);
  const severityLevel = normalizeSeverity(data.level, impactScore);

  const detectedClasses = [
    ...new Set(objekList.map((obj) => obj.kelas).filter(Boolean))
  ].join(', ');

  const labelLevel = String(data.level || 'sedang').toUpperCase();
  const estimatedArea = Number(data.luas_sampah_m2 || 0);

  return {
    source: 'local_onnx',
    capture_category: 'waste_detected',
    is_valid_capture: true,
    is_clean_location: false,
    needs_admin_review: true,
    severity_level: severityLevel,
    impact_score: impactScore,
    description:
      `Tingkat ${labelLevel}: Terdeteksi ${jumlahObjek} objek sampah ` +
      `(${detectedClasses || 'campuran'}), perkiraan luas ` +
      `${estimatedArea} m². Hasil memerlukan verifikasi admin.`
  };
}

// =====================================================
// 2. AI UTAMA: GEMINI
// =====================================================

const GEMINI_PROMPT = `
Kamu adalah sistem validasi foto untuk aplikasi pelaporan sampah lingkungan.

Tujuan utama:
Menentukan apakah foto menunjukkan sampah yang benar-benar berada
di lingkungan fisik dan layak menjadi bukti laporan.

Pilih tepat satu kategori:

1. invalid_photo
Foto buram, terlalu gelap, terlalu terang, goyang, tertutup,
atau objek lingkungan tidak dapat dinilai.

2. clean_location
Foto lingkungan nyata terlihat jelas, tetapi tidak ditemukan sampah.

3. waste_detected
Sampah nyata terlihat berada di lingkungan fisik.

4. review_required
Foto meragukan, tidak dapat dipastikan sebagai kondisi lingkungan nyata,
atau memerlukan pemeriksaan manusia.

ATURAN VALIDASI YANG SANGAT PENTING:

A. BUKAN SAMPAH NYATA:
- Foto sampah yang hanya tampil pada layar HP.
- Foto sampah yang tampil pada layar laptop atau komputer.
- Foto sampah yang tampil pada layar tablet atau televisi.
- Screenshot, gambar digital, atau foto dari galeri yang ditampilkan
  pada perangkat lain.
- Poster, brosur, majalah, koran, atau media cetak yang menggambarkan sampah.
- Ilustrasi, lukisan, gambar kartun, desain grafis, atau render digital.

B. Jika sampah hanya terlihat sebagai gambar pada layar atau media cetak,
jangan klasifikasikan sebagai waste_detected.

C. Jika tidak yakin apakah sampah benar-benar berada di lingkungan fisik,
gunakan review_required.

D. Jangan menganggap bayangan, pola, tekstur, atau objek yang tidak jelas
sebagai sampah.

E. Jangan membuat asumsi lokasi, jenis, atau jumlah sampah yang tidak terlihat.

Tingkat keparahan:
- low
- medium
- high
- critical

Impact score:
Angka 0 sampai 100.
Jika bukan waste_detected, berikan nilai 0.

Kembalikan HANYA JSON valid dengan format:

{
  "capture_category": "review_required",
  "severity_level": "low",
  "impact_score": 0,
  "description": "Alasan singkat hasil analisis"
}

capture_category hanya boleh:
invalid_photo, clean_location, waste_detected, review_required.
`;

async function generateWithRetry(request, maxRetries = 2) {
  const ai = getGeminiClient();
  let lastError;

  for (let attempt = 0; attempt <= maxRetries; attempt++) {
    try {
      return await ai.models.generateContent(request);
    } catch (error) {
      lastError = error;
      const status = Number(error.status || error.code);

      if (!RETRYABLE_STATUS.includes(status) || attempt === maxRetries) {
        throw error;
      }

      await sleep(1000 * 2 ** attempt);
    }
  }

  throw lastError;
}

async function analyzeWithGemini(fileBuffer, mimeType) {
  if (!fileBuffer || fileBuffer.length === 0) {
    throw new Error('Buffer gambar kosong.');
  }

  const safeMimeType = mimeType && mimeType.startsWith('image/')
    ? mimeType
    : 'image/jpeg';

  let response = null;
  let usedModel = null;
  let lastModelError = null;

  for (const modelName of GEMINI_CANDIDATE_MODELS) {
    try {
      response = await generateWithRetry({
        model: modelName,
        contents: [
          GEMINI_PROMPT,
          {
            inlineData: {
              data: fileBuffer.toString('base64'),
              mimeType: safeMimeType
            }
          }
        ],
        config: {
          responseMimeType: 'application/json'
        }
      });
      usedModel = modelName;
      break;
    } catch (err) {
      lastModelError = err;
      const status = Number(err.status || err.code);
      const msg = String(err.message || '');

      // Jika model 404 NOT_FOUND, lanjutkan ke model kandidat berikutnya
      if (status === 404 || msg.includes('404') || msg.includes('NOT_FOUND')) {
        console.warn(`[Gemini] Model ${modelName} tidak tersedia (404), mencoba kandidat berikutnya...`);
        continue;
      }
      throw err;
    }
  }

  if (!response) {
    throw lastModelError || new Error('Semua kandidat model Gemini gagal.');
  }

  let rawText = '';
  try {
    rawText = typeof response.text === 'function' ? response.text() : response.text;
  } catch (textErr) {
    const candidateText = response?.candidates?.[0]?.content?.parts?.[0]?.text;
    if (candidateText) {
      rawText = candidateText;
    } else {
      throw new Error(`Respons Gemini diblokir atau tidak terbaca: ${textErr.message}`);
    }
  }

  if (!rawText) {
    throw new Error('Gemini memberikan respons kosong.');
  }

  let parsed;
  try {
    parsed = parseJsonResponse(rawText);
  } catch {
    throw new Error(`Respons Gemini bukan JSON valid: ${rawText.slice(0, 120)}`);
  }

  const category = String(parsed.capture_category || '').toLowerCase().trim();

  if (!VALID_CATEGORIES.includes(category)) {
    throw new Error(`Kategori hasil Gemini tidak valid: "${category}"`);
  }

  console.log(`[Gemini SUCCESS] Model: ${usedModel} | Kategori: ${category}`);

  const description = String(
    parsed.description || 'Analisis foto selesai.'
  ).slice(0, 1000);

  const impactScore = clampScore(parsed.impact_score, 0, 100);

  if (category === 'invalid_photo') {
    return invalidPhotoResult(description, 'gemini');
  }

  if (category === 'clean_location') {
    return cleanLocationResult(description, 'gemini');
  }

  if (category === 'review_required') {
    return reviewRequiredResult(description, 'gemini');
  }

  return {
    source: 'gemini',
    capture_category: 'waste_detected',
    is_valid_capture: true,
    is_clean_location: false,
    needs_admin_review: false,
    severity_level: normalizeSeverity(parsed.severity_level, impactScore),
    impact_score: Math.max(15, impactScore),
    description
  };
}

// =====================================================
// 3. FUNGSI UTAMA: GEMINI (ONNX hanya jika LOCAL_AI_URL diisi)
// =====================================================

async function analyzeWasteImage(
  fileBuffer,
  mimeType,
  filename = 'waste.jpg'
) {
  try {
    return await analyzeWithGemini(fileBuffer, mimeType);
  } catch (geminiError) {
    console.error('[Gemini ERROR]', {
      attemptedModels: GEMINI_CANDIDATE_MODELS,
      status: geminiError.status || geminiError.code,
      message: geminiError.message
    });

    if (!LOCAL_AI_URL) {
      throw new Error(`Layanan AI tidak tersedia. ${geminiError.message}`);
    }

    try {
      return await analyzeWithLocalModel(fileBuffer, mimeType, filename);
    } catch (localError) {
      console.error('[ONNX ERROR]', localError.message);

      throw new Error(
        `Layanan AI tidak tersedia. Gemini: ${geminiError.message}`
      );
    }
  }
}

module.exports = {
  analyzeWasteImage,
  analyzeWithLocalModel,
  analyzeWithGemini
};