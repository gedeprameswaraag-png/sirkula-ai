const { GoogleGenAI } = require('@google/genai');
const env = require('../config/env');

const LOCAL_AI_URL = process.env.LOCAL_AI_URL || 'http://127.0.0.1:8000/analyze';

function normalizeSeverity(rawLevel, score = 30) {
  const val = String(rawLevel || '').toLowerCase().trim();
  if (['critical', 'kritis', 'sangat_parah', 'sangat parah'].includes(val)) return 'critical';
  if (['high', 'tinggi', 'parah', 'berat'].includes(val)) return 'high';
  if (['medium', 'sedang', 'menengah'].includes(val)) return 'medium';
  if (['low', 'rendah', 'ringan'].includes(val)) return 'low';

  if (score >= 80) return 'critical';
  if (score >= 60) return 'high';
  if (score >= 38) return 'medium';
  return 'low';
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

  return Math.min(100, Math.max(15, base + areaBonus + countBonus));
}

// 1. Model Lokal (best.onnx via api.py -> POST /analyze)
async function analyzeWithLocalModel(fileBuffer, mimeType, filename = 'waste.jpg') {
  const formData = new FormData();
  const blob = new Blob([fileBuffer], { type: mimeType });
  formData.append('foto', blob, filename);

  const response = await fetch(LOCAL_AI_URL, {
    method: 'POST',
    body: formData
  });

  if (!response.ok) {
    const errText = await response.text().catch(() => '');
    throw new Error(`Local AI error (${response.status}): ${errText}`);
  }

  const data = await response.json();
  const status = String(data.status || '').toLowerCase();
  const jumlahObjek = Number(data.jumlah_objek || 0);
  const alasanList = Array.isArray(data.alasan) ? data.alasan : [];
  const objekList = Array.isArray(data.objek) ? data.objek : [];

  const maxConf = objekList.length > 0
    ? Math.max(...objekList.map((o) => Number(o.confidence || 0)))
    : 0;

  // KATEGORI 1: FOTO TIDAK JELAS (buram, gelap, terlalu terang, resolusi tidak pas)
  if (status === 'foto_ulang') {
    return {
      source: 'local_onnx',
      capture_category: 'invalid_photo',
      is_valid_capture: false,
      is_clean_location: false,
      needs_admin_review: false,
      severity_level: 'low',
      impact_score: 0,
      description: alasanList[0] || 'Foto tidak jelas (buram, goyang, atau pencahayaan kurang pas). Silakan ambil foto ulang.'
    };
  }

  // KATEGORI 2: LOKASI BERSIH (kualitas foto tajam & jelas, tetapi 0 objek sampah)
  if (jumlahObjek === 0) {
    return {
      source: 'local_onnx',
      capture_category: 'clean_location',
      is_valid_capture: false,
      is_clean_location: true,
      needs_admin_review: false,
      severity_level: 'low',
      impact_score: 0,
      description: 'Lokasi terpantau bersih dan bebas dari tumpukan sampah.'
    };
  }

  // KATEGORI 1B: Deteksi meragukan / bukan sampah (confidence rendah < 0.55) -> foto tidak sesuai
  const lowConfidence = alasanList.some((a) => a.toLowerCase().includes('keyakinan model rendah')) || maxConf < 0.55;
  if (lowConfidence) {
    return {
      source: 'local_onnx',
      capture_category: 'invalid_photo',
      is_valid_capture: false,
      is_clean_location: false,
      needs_admin_review: false,
      severity_level: 'low',
      impact_score: 0,
      description: 'Objek pada foto tidak jelas atau tidak sesuai sebagai bukti sampah. Silakan coba foto lain.'
    };
  }

  // KATEGORI 3: LOKASI KOTOR (sampah terdeteksi dengan yakin)
  const impactScore = computeLocalImpactScore(data);
  const severityLevel = normalizeSeverity(data.level, impactScore);
  const kelasTerdeteksi = [...new Set(objekList.map((o) => o.kelas).filter(Boolean))].join(', ');
  const labelTingkat = (data.level || 'sedang').toUpperCase();

  return {
    source: 'local_onnx',
    capture_category: 'waste_detected',
    is_valid_capture: true,
    is_clean_location: false,
    needs_admin_review: false,
    severity_level: severityLevel,
    impact_score: impactScore,
    description: `Tingkat ${labelTingkat}: Terdeteksi ${jumlahObjek} objek sampah (${kelasTerdeteksi || 'campuran'}), perkiraan luas ${data.luas_sampah_m2 || 0} m².`
  };
}

// 2. Fungsi Utama: Gemini Utama + Otomatis Fallback ke Model Lokal
async function analyzeWasteImage(fileBuffer, mimeType, filename = 'waste.jpg') {
  try {
    if (!env.GEMINI_API_KEY) {
      throw new Error('GEMINI_API_KEY tidak dikonfigurasi.');
    }

    const ai = new GoogleGenAI({ apiKey: env.GEMINI_API_KEY });
    const base64Image = fileBuffer.toString('base64');

    const prompt = `Periksa foto lapangan ini dan bedakan dengan tegas ke dalam 3 kategori:
1. "invalid_photo": Jika foto goyang, buram, terlalu gelap/terang, tertutup jari, atau objek tidak jelas sehingga kondisi lingkungan tidak bisa dinilai.
2. "clean_location": Jika foto tajam dan lingkungan terlihat jelas, namun area tersebut BERSIH (tidak ada sampah).
3. "waste_detected": Jika terlihat tumpukan atau sebaran sampah dengan jelas.

Kembalikan HANYA JSON valid:
{
  "capture_category": "invalid_photo" | "clean_location" | "waste_detected",
  "severity_level": "low" | "medium" | "high" | "critical",
  "impact_score": number (0 jika bersih/tidak jelas, 1-100 jika ada sampah),
  "description": "penjelasan singkat kondisi foto"
}`;

    const response = await ai.models.generateContent({
      model: process.env.GEMINI_MODEL || 'gemini-2.5-flash-lite',
      contents: [
        prompt,
        { inlineData: { data: base64Image, mimeType } }
      ],
      config: { responseMimeType: 'application/json' }
    });

    const parsed = JSON.parse(response.text);
    const category = parsed.capture_category || 'invalid_photo';
    const impactScore = Number(parsed.impact_score || 0);

    return {
      source: 'gemini',
      capture_category: category,
      is_valid_capture: category === 'waste_detected',
      is_clean_location: category === 'clean_location',
      needs_admin_review: false,
      severity_level: category === 'waste_detected' ? normalizeSeverity(parsed.severity_level, impactScore) : 'low',
      impact_score: category === 'waste_detected' ? Math.max(15, impactScore) : 0,
      description: parsed.description || 'Tervalidasi.'
    };
  } catch (geminiError) {
    console.warn('[AI Fallback] Beralih ke model lokal:', geminiError.message);
    return await analyzeWithLocalModel(fileBuffer, mimeType, filename);
  }
}

module.exports = { analyzeWasteImage };