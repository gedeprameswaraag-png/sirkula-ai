
const { GoogleGenAI } = require('@google/genai');
const env = require('../config/env');

const LOCAL_AI_URL =
  process.env.LOCAL_AI_URL || 'http://127.0.0.1:8000/analyze';

const LOCAL_AI_TIMEOUT_MS = Number(
  process.env.LOCAL_AI_TIMEOUT_MS || 30000
);

const VALID_CATEGORIES = [
  'invalid_photo',
  'clean_location',
  'waste_detected'
];

function normalizeSeverity(rawLevel, score = 30) {
  const val = String(rawLevel || '').toLowerCase().trim();

  if (['critical', 'kritis', 'sangat_parah', 'sangat parah'].includes(val)) {
    return 'critical';
  }

  if (['high', 'tinggi', 'parah', 'berat'].includes(val)) {
    return 'high';
  }

  if (['medium', 'sedang', 'menengah'].includes(val)) {
    return 'medium';
  }

  if (['low', 'rendah', 'ringan'].includes(val)) {
    return 'low';
  }

  if (score >= 80) return 'critical';
  if (score >= 60) return 'high';
  if (score >= 38) return 'medium';

  return 'low';
}

function clampScore(value, min = 0, max = 100) {
  const number = Number(value);

  if (!Number.isFinite(number)) return min;

  return Math.min(max, Math.max(min, Math.round(number)));
}

function invalidPhotoResult(description) {
  return {
    source: 'ai',
    capture_category: 'invalid_photo',
    is_valid_capture: false,
    is_clean_location: false,
    needs_admin_review: false,
    severity_level: 'low',
    impact_score: 0,
    description
  };
}

function cleanLocationResult(description) {
  return {
    source: 'ai',
    capture_category: 'clean_location',
    is_valid_capture: false,
    is_clean_location: true,
    needs_admin_review: false,
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

  const areaBonus = Math.min(
    18,
    Math.round(areaM2 * 4 + pileAreaM2 * 5)
  );

  const countBonus = Math.min(7, Math.floor(count / 3));

  return clampScore(base + areaBonus + countBonus, 15, 100);
}

// =====================================================
// 1. FALLBACK: MODEL LOKAL ONNX MELALUI PYTHON FASTAPI
// =====================================================

async function analyzeWithLocalModel(
  fileBuffer,
  mimeType,
  filename = 'waste.jpg'
) {
  const formData = new FormData();

  const blob = new Blob([fileBuffer], { type: mimeType });
  formData.append('foto', blob, filename);

  const controller = new AbortController();
  const timeout = setTimeout(
    () => controller.abort(),
    LOCAL_AI_TIMEOUT_MS
  );

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
    throw new Error(
      `Local AI error (${response.status}): ${errorText}`
    );
  }

  const data = await response.json();

  const status = String(data.status || '').toLowerCase();
  const jumlahObjek = Number(data.jumlah_objek || 0);
  const alasanList = Array.isArray(data.alasan)
    ? data.alasan
    : [];
  const objekList = Array.isArray(data.objek)
    ? data.objek
    : [];

  const maxConf = objekList.length > 0
    ? Math.max(
        ...objekList.map((obj) => Number(obj.confidence || 0))
      )
    : 0;

  // Foto tidak layak dianalisis.
  if (status === 'foto_ulang') {
    return {
      ...invalidPhotoResult(
        alasanList[0] ||
        'Foto tidak jelas. Silakan ambil foto ulang.'
      ),
      source: 'local_onnx'
    };
  }

  // Tidak ditemukan objek sampah.
  if (jumlahObjek === 0) {
    return {
      ...cleanLocationResult(
        'Lokasi terpantau bersih dan tidak ditemukan objek sampah.'
      ),
      source: 'local_onnx'
    };
  }

  // Deteksi harus memiliki keyakinan minimal 0,55.
  const lowConfidence =
    alasanList.some((reason) =>
      String(reason).toLowerCase().includes('keyakinan model rendah')
    ) ||
    !Number.isFinite(maxConf) ||
    maxConf < 0.55;

  if (lowConfidence) {
    return {
      ...invalidPhotoResult(
        'Objek pada foto tidak cukup jelas untuk divalidasi. Silakan ambil foto ulang.'
      ),
      source: 'local_onnx'
    };
  }

  // Sampah terdeteksi.
  const impactScore = computeLocalImpactScore(data);
  const severityLevel = normalizeSeverity(
    data.level,
    impactScore
  );

  const detectedClasses = [
    ...new Set(
      objekList
        .map((obj) => obj.kelas)
        .filter(Boolean)
    )
  ].join(', ');

  const labelLevel = String(data.level || 'sedang').toUpperCase();

  const estimatedArea = Number(data.luas_sampah_m2 || 0);

  return {
    source: 'local_onnx',
    capture_category: 'waste_detected',
    is_valid_capture: true,
    is_clean_location: false,
    needs_admin_review: false,
    severity_level: severityLevel,
    impact_score: impactScore,
    description:
      `Tingkat ${labelLevel}: Terdeteksi ${jumlahObjek} objek sampah ` +
      `(${detectedClasses || 'campuran'}), perkiraan luas ` +
      `${estimatedArea} m².`
  };
}

// =====================================================
// 2. AI UTAMA: GEMINI
// =====================================================

async function analyzeWithGemini(
  fileBuffer,
  mimeType
) {
  if (!env.GEMINI_API_KEY) {
    throw new Error('GEMINI_API_KEY tidak dikonfigurasi.');
  }

  const ai = new GoogleGenAI({
    apiKey: env.GEMINI_API_KEY
  });

  const base64Image = fileBuffer.toString('base64');

  const prompt = `
Analisis foto lingkungan untuk mendeteksi keberadaan sampah.

Tentukan tepat satu kategori:

1. invalid_photo:
   Foto buram, goyang, terlalu gelap, terlalu terang,
   tertutup, atau kondisi lingkungan tidak dapat dinilai.

2. clean_location:
   Foto jelas dan kondisi lingkungan terlihat,
   tetapi tidak ditemukan sampah.

3. waste_detected:
   Terlihat sampah nyata di lingkungan, baik berupa
   tumpukan maupun sampah yang tersebar.

Perhatikan bahwa objek sampah harus terlihat cukup jelas.
Jangan menyimpulkan adanya sampah hanya dari objek yang
tidak dapat dikenali.

Berikan severity:
- low
- medium
- high
- critical

Berikan impact_score berupa angka 0 sampai 100.
Jika foto invalid atau lokasi bersih, impact_score harus 0.

Kembalikan HANYA JSON valid dengan format:
{
  "capture_category": "invalid_photo",
  "severity_level": "low",
  "impact_score": 0,
  "description": "Penjelasan singkat hasil analisis"
}

Nilai capture_category harus salah satu dari:
invalid_photo, clean_location, waste_detected.
`;

  const response = await ai.models.generateContent({
    model: process.env.GEMINI_MODEL || 'gemini-2.5-flash-lite',
    contents: [
      prompt,
      {
        inlineData: {
          data: base64Image,
          mimeType
        }
      }
    ],
    config: {
      responseMimeType: 'application/json'
    }
  });

  if (!response.text) {
    throw new Error('Gemini memberikan respons kosong.');
  }

  const parsed = JSON.parse(response.text);

  const category = String(
    parsed.capture_category || ''
  ).toLowerCase();

  if (!VALID_CATEGORIES.includes(category)) {
    throw new Error('Kategori hasil Gemini tidak valid.');
  }

  const impactScore = clampScore(
    parsed.impact_score,
    0,
    100
  );

  const description = String(
    parsed.description || 'Analisis foto selesai.'
  ).slice(0, 1000);

  if (category === 'invalid_photo') {
    return {
      ...invalidPhotoResult(description),
      source: 'gemini'
    };
  }

  if (category === 'clean_location') {
    return {
      ...cleanLocationResult(description),
      source: 'gemini'
    };
  }

  return {
    source: 'gemini',
    capture_category: 'waste_detected',
    is_valid_capture: true,
    is_clean_location: false,
    needs_admin_review: false,
    severity_level: normalizeSeverity(
      parsed.severity_level,
      impactScore
    ),
    impact_score: Math.max(15, impactScore),
    description
  };
}

// =====================================================
// 3. FUNGSI UTAMA: GEMINI -> ONNX FALLBACK
// =====================================================

async function analyzeWasteImage(
  fileBuffer,
  mimeType,
  filename = 'waste.jpg'
) {
  try {
    return await analyzeWithGemini(
      fileBuffer,
      mimeType
    );
  } catch (geminiError) {
    console.warn(
      '[AI Fallback] Gemini gagal. Beralih ke ONNX:',
      geminiError.message
    );

    try {
      return await analyzeWithLocalModel(
        fileBuffer,
        mimeType,
        filename
      );
    } catch (localError) {
      console.error(
        '[AI Fallback Error] Gemini dan ONNX gagal:',
        localError.message
      );

      throw new Error(
        'Layanan AI sedang tidak tersedia. Silakan coba beberapa saat lagi.'
      );
    }
  }
}

module.exports = {
  analyzeWasteImage,
  analyzeWithLocalModel
};
