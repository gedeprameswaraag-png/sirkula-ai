// Aturan XP & level relawan (dipakai controller admin saat menyetujui tugas)
const XP_BY_SEVERITY = Object.freeze({ ringan: 10, sedang: 25, parah: 50 });

function xpForSeverity(level) {
  return XP_BY_SEVERITY[level] ?? XP_BY_SEVERITY.sedang;
}

function computeVolunteerLevel(xp) {
  if (xp >= 350) return 'Master';
  if (xp >= 150) return 'Ahli';
  if (xp >= 50) return 'Menengah';
  return 'Pemula';
}

module.exports = { XP_BY_SEVERITY, xpForSeverity, computeVolunteerLevel };
