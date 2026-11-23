// Penyimpanan sementara di localStorage.
// Nanti diganti dengan Supabase (tabel reports + Storage untuk foto).
const KEY = 'sirkulaai_reports_v1';

export function loadReports() {
  try {
    return JSON.parse(localStorage.getItem(KEY) || '[]');
  } catch {
    return [];
  }
}

function persist(list) {
  try {
    localStorage.setItem(KEY, JSON.stringify(list));
  } catch (e) {
    console.error('Gagal menyimpan laporan:', e);
  }
  return list;
}

export function addReport(report) {
  return persist([report, ...loadReports()]);
}

export function updateReport(id, patch) {
  return persist(loadReports().map((r) => (r.id === id ? { ...r, ...patch } : r)));
}

export function clearReports() {
  return persist([]);
}

export function seedDemo(center) {
  const samples = [
    ['parah', 'ai_done', 'Tumpukan sampah rumah tangga di pinggir jalan', 'Plastic'],
    ['parah', 'needs_review', 'Sampah campuran menutupi saluran air', 'Other'],
    ['sedang', 'ai_done', 'Sampah plastik berserakan di lahan kosong', 'Plastic'],
    ['sedang', 'ai_done', 'Kardus dan kertas menumpuk di sudut pasar', 'Paper/cardboard'],
    ['ringan', 'ai_done', 'Beberapa botol dan bungkus makanan di trotoar', 'Plastic'],
    ['ringan', 'ai_done', 'Sampah daun dan plastik kecil di taman', 'Organic'],
    [null, 'pending_ai', 'Menunggu analisis AI', 'Unknown'],
    ['ringan', 'cleaned', 'Sudah dibersihkan warga', 'Plastic'],
  ];
  const offsets = [
    [0.004, 0.003], [-0.005, 0.006], [0.007, -0.004], [-0.003, -0.007],
    [0.001, 0.009], [-0.008, 0.001], [0.009, 0.008], [-0.002, -0.002],
  ];
  const now = Date.now();
  const demo = samples.map(([severity, status, summary, category], i) => ({
    id: `demo-${i}-${now}`,
    lat: center.lat + offsets[i][0],
    lng: center.lng + offsets[i][1],
    accuracy: 15,
    createdAt: now - i * 3600 * 1000 * 5,
    status,
    severity,
    category,
    summary,
    validity: 'valid',
    thumb: null,
    demo: true,
  }));
  return persist([...demo, ...loadReports()]);
}
