export const COLORS = {
  parah: '#CF3F2B',
  sedang: '#E19A1A',
  ringan: '#3F9A66',
  pending: '#7A8A99',
  cleaned: '#0F5E5A',
};

export const SEVERITY = {
  parah: { label: 'Parah', radius: 14 },
  sedang: { label: 'Sedang', radius: 11 },
  ringan: { label: 'Ringan', radius: 8 },
};

export const STATUS = {
  pending_ai: 'Menunggu analisis AI',
  ai_done: 'Sudah dianalisis AI',
  needs_review: 'Menunggu verifikasi admin',
  cleanup_review: 'Konfirmasi bersih menunggu verifikasi',
  cleaned: 'Sudah bersih',
};

// Jarak maksimum pelapor dari titik laporan saat konfirmasi bersih
export const CLEANUP_RADIUS_M = 150;

// Pusat peta bawaan (Jawa Tengah) sebelum GPS tersedia
export const DEFAULT_CENTER = { lat: -7.33, lng: 110.5 };
