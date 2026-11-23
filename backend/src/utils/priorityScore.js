// Priority Score SirkulaAI (formula awal dari SRS)
//   Priority Score = 0,35 S + 0,25 E + 0,20 R + 0,20 F
// S = keparahan visual, E = risiko lingkungan/lokasi, R = laporan berulang,
// F = kesegaran verifikasi. Setiap faktor 0-100, skor akhir 0-100.
// Skor adalah alat bantu pengurutan, bukan keputusan otomatis.
// SEMUA angka di bawah adalah nilai awal dan wajib dikalibrasi.

const FORMULA_VERSION = 'v0.1-belum-dikalibrasi';

const WEIGHTS = Object.freeze({
  severity: 0.35,
  environment: 0.25,
  repeat: 0.2,
  freshness: 0.2,
});

// Batas level untuk warna peta (ringan / sedang / parah)
const LEVEL_THRESHOLDS = Object.freeze({ parah: 70, sedang: 40 });

const SEVERITY_BASE = Object.freeze({ bersih: 0, ringan: 25, sedang: 60, parah: 90 });
// environmental_risk dari AI berupa array teks bebas, jadi dinilai dari jumlah risiko
// yang disebut AI (0 risiko = 20, 1 = 40, 2 = 55, 3 atau lebih = 70).
const ENV_COUNT_BASE = Object.freeze([20, 40, 55, 70]);
const ENV_UNKNOWN_DEFAULT = 30;
const ENV_WATER_BONUS = 10; // risiko menyebut air, sungai, saluran, banjir
const ENV_BONUS = Object.freeze({ hazardous: 20, e_waste: 10 });
const WATER_PATTERN = /(sungai|air|saluran|selokan|got|parit|banjir|river|water|drain|flood)/i;

const REPEAT_RADIUS_M = 50; // laporan dalam radius ini dianggap titik yang sama
const REPEAT_WINDOW_DAYS = 30;
const REPEAT_SATURATION = 3; // 3 pelapor lain berbeda = skor R 100
const FRESHNESS_WINDOW_HOURS = 168; // 7 hari, F turun linear dari 100 ke 0

const weightSum = Object.values(WEIGHTS).reduce((a, b) => a + b, 0);
if (Math.abs(weightSum - 1) > 1e-9) {
  throw new Error(`Total bobot harus 1, saat ini ${weightSum}`);
}

const clamp = (n, min = 0, max = 100) => Math.min(max, Math.max(min, n));
const round1 = (n) => Math.round(n * 10) / 10;
const round2 = (n) => Math.round(n * 100) / 100;

function distanceM(a, b) {
  const R = 6371000;
  const rad = (d) => (d * Math.PI) / 180;
  const dLat = rad(b.lat - a.lat);
  const dLng = rad(b.lng - a.lng);
  const h =
    Math.sin(dLat / 2) ** 2 +
    Math.cos(rad(a.lat)) * Math.cos(rad(b.lat)) * Math.sin(dLng / 2) ** 2;
  return 2 * R * Math.asin(Math.sqrt(h));
}

function normalizeSeverityLabel(v) {
  if (typeof v === 'number') return clamp(v); // sudah skala 0-100
  if (typeof v !== 'string') return null;
  const s = v.toLowerCase();
  if (/(none|clean|bersih|no_waste)/.test(s)) return 'bersih';
  if (/(high|severe|critical|parah|berat|tinggi)/.test(s)) return 'parah';
  if (/(medium|moderate|sedang)/.test(s)) return 'sedang';
  if (/(low|light|minor|ringan|rendah)/.test(s)) return 'ringan';
  return null;
}

// ---------- Faktor S ----------
function severityFactor(severity) {
  const norm = normalizeSeverityLabel(severity);
  if (typeof norm === 'number') {
    return { value: norm, reasons: [`Skor keparahan dari AI: ${norm}`], incomplete: false };
  }
  if (norm) {
    return { value: SEVERITY_BASE[norm], reasons: [`Keparahan visual "${norm}"`], incomplete: false };
  }
  return { value: 50, reasons: ['Keparahan tidak diketahui, memakai nilai tengah 50'], incomplete: true };
}

// ---------- Faktor E ----------
function environmentFactor({ environmentalRisks, categories, locationRisk }) {
  const reasons = [];
  let incomplete = false;
  let base;

  if (Array.isArray(environmentalRisks)) {
    const risks = environmentalRisks.filter((r) => typeof r === 'string' && r.trim() !== '');
    base = ENV_COUNT_BASE[Math.min(risks.length, ENV_COUNT_BASE.length - 1)];
    reasons.push(`AI menyebut ${risks.length} risiko lingkungan`);
    if (risks.some((r) => WATER_PATTERN.test(r))) {
      base += ENV_WATER_BONUS;
      reasons.push(`Risiko menyangkut air/saluran, +${ENV_WATER_BONUS}`);
    }
  } else {
    base = ENV_UNKNOWN_DEFAULT;
    incomplete = true;
    reasons.push(`Risiko lingkungan tidak tersedia, memakai ${ENV_UNKNOWN_DEFAULT}`);
  }

  const cats = Array.isArray(categories) ? categories.map((c) => String(c).toLowerCase()) : [];
  if (cats.includes('hazardous')) {
    base += ENV_BONUS.hazardous;
    reasons.push(`Kategori hazardous, +${ENV_BONUS.hazardous}`);
  } else if (cats.includes('e_waste')) {
    base += ENV_BONUS.e_waste;
    reasons.push(`Kategori e_waste, +${ENV_BONUS.e_waste}`);
  }

  let value = clamp(base);
  if (typeof locationRisk === 'number' && locationRisk > value) {
    value = clamp(locationRisk);
    reasons.push(`Risiko lokasi (${value}) lebih tinggi dari penilaian AI, dipakai sebagai nilai E`);
  }
  return { value, reasons, incomplete };
}

// ---------- Faktor R ----------
function repeatFactor({ location, reportId, userId, nearbyReports, now }) {
  if (!location || !Number.isFinite(location.lat) || !Number.isFinite(location.lng)) {
    return { value: 0, reasons: ['Lokasi tidak dikirim, R = 0'], incomplete: true, count: 0 };
  }
  const windowMs = REPEAT_WINDOW_DAYS * 24 * 3600 * 1000;
  const reporters = new Set();

  for (const r of nearbyReports || []) {
    if (r.id !== undefined && r.id === reportId) continue;
    if (userId !== undefined && r.userId !== undefined && r.userId === userId) continue;
    if (['cleaned', 'rejected', 'invalid'].includes(r.status)) continue;
    if (typeof r.lat !== 'number' || typeof r.lng !== 'number') continue;

    const created = new Date(r.createdAt ?? r.created_at).getTime();
    if (!Number.isFinite(created) || now - created > windowMs || created > now) continue;
    if (distanceM(location, { lat: r.lat, lng: r.lng }) > REPEAT_RADIUS_M) continue;

    reporters.add(r.userId ?? r.id);
  }

  const count = reporters.size;
  const value = clamp((count / REPEAT_SATURATION) * 100);
  return {
    value,
    reasons: [`${count} laporan dari pelapor lain dalam ${REPEAT_RADIUS_M} m selama ${REPEAT_WINDOW_DAYS} hari terakhir`],
    incomplete: false,
    count,
  };
}

// ---------- Faktor F ----------
function freshnessFactor({ lastEvidenceAt, now }) {
  const t = new Date(lastEvidenceAt).getTime();
  if (!Number.isFinite(t)) {
    return { value: 0, reasons: ['Waktu verifikasi terakhir tidak diketahui, F = 0'], incomplete: true };
  }
  const ageHours = Math.max(0, (now - t) / 3600000);
  const value = clamp(100 * (1 - ageHours / FRESHNESS_WINDOW_HOURS));
  return {
    value,
    reasons: [`Bukti terakhir ${round1(ageHours)} jam lalu (nol setelah ${FRESHNESS_WINDOW_HOURS} jam)`],
    incomplete: false,
  };
}

function levelFromScore(score) {
  if (score >= LEVEL_THRESHOLDS.parah) return 'parah';
  if (score >= LEVEL_THRESHOLDS.sedang) return 'sedang';
  return 'ringan';
}

/**
 * Hitung Priority Score satu laporan.
 *
 * @param {object} input
 * @param {{severity, environmentalRisks, categories}} input.ai  hasil AI (lihat fromAiResult)
 * @param {{lat:number, lng:number}|null} input.location
 * @param {string|number} [input.reportId]
 * @param {string|number} [input.userId]
 * @param {Array} [input.nearbyReports]  laporan lain {id,userId,lat,lng,createdAt,status}
 * @param {Date|number|string} [input.lastEvidenceAt]  default: sekarang (laporan baru)
 * @param {number} [input.locationRisk]  0-100, dari data zona rawan (opsional, nanti)
 * @param {number} [input.now]
 */
function computePriority(input) {
  const now = input.now ?? Date.now();
  const ai = input.ai || {};

  const factors = {
    severity: severityFactor(ai.severity),
    environment: environmentFactor({
      environmentalRisks: ai.environmentalRisks,
      categories: ai.categories,
      locationRisk: input.locationRisk,
    }),
    repeat: repeatFactor({
      location: input.location,
      reportId: input.reportId,
      userId: input.userId,
      nearbyReports: input.nearbyReports,
      now,
    }),
    freshness: freshnessFactor({ lastEvidenceAt: input.lastEvidenceAt ?? now, now }),
  };

  let total = 0;
  const breakdown = {};
  const flags = [];
  for (const key of Object.keys(WEIGHTS)) {
    const f = factors[key];
    const contribution = WEIGHTS[key] * f.value;
    total += contribution;
    breakdown[key] = {
      value: round1(f.value),
      weight: WEIGHTS[key],
      contribution: round2(contribution),
      reasons: f.reasons,
    };
    if (f.incomplete) flags.push(`data_${key}_tidak_lengkap`);
  }

  const score = round1(clamp(total));
  return {
    score,
    level: levelFromScore(score),
    formulaVersion: FORMULA_VERSION,
    breakdown,
    flags,
    note: 'Skor adalah alat bantu pengurutan, bukan keputusan otomatis.',
  };
}

// Adaptor dari JSON Gemini (skema di aiController.js) ke input computePriority.
function fromAiResult(raw) {
  const r = raw || {};
  return {
    severity: r.severity, // low | medium | high | unknown
    environmentalRisks: r.environmental_risk, // array teks
    categories: r.waste_categories, // array kategori
  };
}

module.exports = {
  computePriority,
  fromAiResult,
  levelFromScore,
  WEIGHTS,
  LEVEL_THRESHOLDS,
  FORMULA_VERSION,
};
