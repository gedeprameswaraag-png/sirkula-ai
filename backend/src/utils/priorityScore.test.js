const test = require('node:test');
const assert = require('node:assert/strict');
const { computePriority, levelFromScore, fromAiResult, WEIGHTS } = require('./priorityScore');

const NOW = Date.parse('2026-11-19T12:00:00Z');
const HERE = { lat: -7.33, lng: 110.5 };
const hoursAgo = (h) => new Date(NOW - h * 3600000).toISOString();
const near = (id, userId, extra = {}) => ({
  id, userId, lat: HERE.lat, lng: HERE.lng, createdAt: hoursAgo(24), status: 'ai_done', ...extra,
});
const closeTo = (a, b, tol = 0.06) => assert.ok(Math.abs(a - b) <= tol, `${a} tidak mendekati ${b}`);

const AI_HIGH = {
  severity: 'high',
  environmentalRisks: ['Pencemaran air sungai', 'Bau menyengat', 'Sarang penyakit'],
  categories: ['plastic'],
};
const base = (over = {}) => computePriority({
  ai: AI_HIGH, location: HERE, reportId: 'r1', userId: 'u1', now: NOW, ...over,
});

test('total bobot = 1', () => {
  closeTo(Object.values(WEIGHTS).reduce((a, b) => a + b, 0), 1, 1e-9);
});

test('laporan baru high: 0.35*90 + 0.25*80 + 0 + 0.20*100 = 71.5', () => {
  const r = base();
  closeTo(r.score, 71.5);
  assert.equal(r.level, 'parah');
  assert.equal(r.breakdown.environment.value, 80);
  assert.equal(r.breakdown.freshness.value, 100);
  assert.deepEqual(r.flags, []);
});

test('laporan baru low tanpa risiko: sekitar 33.8, ringan', () => {
  const r = base({ ai: { severity: 'low', environmentalRisks: [], categories: ['plastic'] } });
  closeTo(r.score, 33.8);
  assert.equal(r.level, 'ringan');
  assert.deepEqual(r.flags, []);
});

test('laporan baru medium dengan satu risiko: 51, sedang', () => {
  const r = base({ ai: { severity: 'medium', environmentalRisks: ['Bau'], categories: ['paper_cardboard'] } });
  closeTo(r.score, 51);
  assert.equal(r.level, 'sedang');
});

test('R: tiga pelapor lain berbeda dalam 50 m = 100', () => {
  const r = base({ nearbyReports: [near('a', 'u2'), near('b', 'u3'), near('c', 'u4')] });
  assert.equal(r.breakdown.repeat.value, 100);
});

test('R: pelapor sama, jauh, kedaluwarsa, sudah bersih, dan laporan sendiri tidak dihitung', () => {
  const r = base({
    nearbyReports: [
      near('a', 'u1'),
      near('b', 'u2', { lat: HERE.lat + 0.01 }),
      near('c', 'u3', { createdAt: hoursAgo(24 * 40) }),
      near('d', 'u4', { status: 'cleaned' }),
      near('r1', 'u5'),
    ],
  });
  assert.equal(r.breakdown.repeat.value, 0);
});

test('R: pelapor yang sama dihitung sekali', () => {
  const r = base({ nearbyReports: [near('a', 'u2'), near('b', 'u2')] });
  closeTo(r.breakdown.repeat.value, 33.3, 0.1);
});

test('R: tanpa lokasi bernilai 0 dan diberi flag', () => {
  const r = base({ location: null, nearbyReports: [near('a', 'u2')] });
  assert.equal(r.breakdown.repeat.value, 0);
  assert.ok(r.flags.includes('data_repeat_tidak_lengkap'));
});

test('F: 84 jam = 50, lebih dari 168 jam = 0', () => {
  assert.equal(base({ lastEvidenceAt: hoursAgo(84) }).breakdown.freshness.value, 50);
  assert.equal(base({ lastEvidenceAt: hoursAgo(300) }).breakdown.freshness.value, 0);
});

test('E: jumlah risiko menentukan nilai dasar', () => {
  const e = (risks) => base({ ai: { severity: 'low', environmentalRisks: risks, categories: [] } }).breakdown.environment.value;
  assert.equal(e([]), 20);
  assert.equal(e(['a']), 40);
  assert.equal(e(['a', 'b']), 55);
  assert.equal(e(['a', 'b', 'c', 'd']), 70);
});

test('E: kategori hazardous +20, e_waste +10, maksimum 100', () => {
  const e = (cats, risks = ['a', 'b']) => base({ ai: { severity: 'low', environmentalRisks: risks, categories: cats } }).breakdown.environment.value;
  assert.equal(e(['hazardous']), 75);
  assert.equal(e(['e_waste']), 65);
  assert.ok(e(['hazardous'], ['air sungai', 'b', 'c']) <= 100);
});

test('E: risiko lokasi yang lebih tinggi dipakai', () => {
  const r = base({ ai: { severity: 'low', environmentalRisks: [], categories: [] }, locationRisk: 85 });
  assert.equal(r.breakdown.environment.value, 85);
});

test('data AI tidak lengkap diberi flag dan memakai nilai bawaan', () => {
  const r = base({ ai: { severity: 'unknown' } });
  assert.equal(r.breakdown.severity.value, 50);
  assert.equal(r.breakdown.environment.value, 30);
  assert.ok(r.flags.includes('data_severity_tidak_lengkap'));
  assert.ok(r.flags.includes('data_environment_tidak_lengkap'));
});

test('batas level', () => {
  assert.equal(levelFromScore(70), 'parah');
  assert.equal(levelFromScore(69.9), 'sedang');
  assert.equal(levelFromScore(40), 'sedang');
  assert.equal(levelFromScore(39.9), 'ringan');
});

test('urutan: high + berulang > low baru', () => {
  const high = base({ nearbyReports: [near('a', 'u2'), near('b', 'u3')] });
  const low = base({ ai: { severity: 'low', environmentalRisks: [], categories: [] } });
  assert.ok(high.score > low.score);
});

test('skor selalu 0-100', () => {
  const max = base({
    ai: { severity: 100, environmentalRisks: ['air', 'b', 'c'], categories: ['hazardous'] },
    nearbyReports: [near('a', 'u2'), near('b', 'u3'), near('c', 'u4')],
  });
  assert.ok(max.score <= 100 && max.score >= 0);
});

test('fromAiResult sesuai skema aiController', () => {
  const ai = fromAiResult({
    waste_detected: true, waste_categories: ['glass'], severity: 'medium', environmental_risk: ['Bau'],
  });
  assert.deepEqual(ai, { severity: 'medium', environmentalRisks: ['Bau'], categories: ['glass'] });
});
