const { supabaseAdmin } = require('../config/supabase');
const { getSignedImageUrl } = require('./storageService');

const CLUSTER_RADIUS_METERS = 35; // Jarak penggabungan titik dalam satu zona area (meter)

const SEVERITY_RANK = {
  parah: 3,
  sedang: 2,
  ringan: 1
};

// Hitung jarak Haversine antar dua koordinat (meter)
function haversineMeters(lat1, lon1, lat2, lon2) {
  const R = 6371000;
  const toRad = (deg) => (deg * Math.PI) / 180;
  const dLat = toRad(lat2 - lat1);
  const dLon = toRad(lon2 - lon1);
  const a =
    Math.sin(dLat / 2) ** 2 +
    Math.cos(toRad(lat1)) * Math.cos(toRad(lat2)) * Math.sin(dLon / 2) ** 2;
  return 2 * R * Math.atan2(Math.sqrt(a), Math.sqrt(1 - a));
}

/**
 * Mengambil seluruh titik hotspot publik dan menggabungkan (cluster)
 * titik-titik yang berada dalam radius 35 meter menjadi satu zona terpadu.
 */
exports.getPublicHotspots = async ({ priorityLevel, category } = {}) => {
  let query = supabaseAdmin
    .from('hotspots')
    .select('*')
    .order('created_at', { ascending: false });

  if (priorityLevel) {
    query = query.eq('priority_level', priorityLevel);
  }
  if (category) {
    query = query.eq('primary_category', category);
  }

  const { data: hotspots, error } = await query;
  if (error) throw error;

  // Ambil seluruh laporan terverifikasi beserta lampiran fotonya
  const { data: reports } = await supabaseAdmin
    .from('reports')
    .select('id, hotspot_id, description, severity_level, created_at, report_images(storage_path)')
    .eq('status', 'verified')
    .order('created_at', { ascending: false });

  // Lampirkan foto pada tiap hotspot individual terlebih dahulu
  const rawZones = await Promise.all(
    (hotspots || []).map(async (hs) => {
      const relatedReports = (reports || []).filter((r) => r.hotspot_id === hs.id);
      const photos = [];

      for (const rep of relatedReports) {
        for (const img of rep.report_images || []) {
          const signedUrl = await getSignedImageUrl('report-photos', img.storage_path).catch(() => null);
          photos.push({
            id: rep.id,
            photo_url: signedUrl,
            severity: rep.severity_level || hs.priority_level,
            description: rep.description,
            created_at: rep.created_at
          });
        }
      }

      return {
        ...hs,
        latitude: Number(hs.latitude),
        longitude: Number(hs.longitude),
        photos,
        total_hotspots: 1,
        member_ids: [hs.id]
      };
    })
  );

  // Gabungkan titik-titik yang jaraknya <= 35 meter menjadi satu zona lingkaran
  const clusteredZones = [];

  for (const item of rawZones) {
    // Hanya gabungkan titik aktif dengan aktif, atau titik selesai dengan selesai
    const existingCluster = clusteredZones.find(
      (cluster) =>
        (cluster.status === 'resolved') === (item.status === 'resolved') &&
        haversineMeters(cluster.latitude, cluster.longitude, item.latitude, item.longitude) <= CLUSTER_RADIUS_METERS
    );

    if (!existingCluster) {
      clusteredZones.push({ ...item });
    } else {
      // Hitung rata-rata titik tengah zona (centroid)
      const count = existingCluster.total_hotspots;
      existingCluster.latitude = (existingCluster.latitude * count + item.latitude) / (count + 1);
      existingCluster.longitude = (existingCluster.longitude * count + item.longitude) / (count + 1);
      existingCluster.total_hotspots = count + 1;
      existingCluster.member_ids.push(item.id);

      // Gabungkan seluruh galeri foto laporan ke dalam satu zona
      existingCluster.photos.push(...item.photos);

      // Ambil tingkat keparahan dan skor tertinggi di zona tersebut
      const currentRank = SEVERITY_RANK[existingCluster.priority_level] || 2;
      const incomingRank = SEVERITY_RANK[item.priority_level] || 2;
      if (incomingRank > currentRank) {
        existingCluster.priority_level = item.priority_level;
      }
      if ((item.priority_score || 0) > (existingCluster.priority_score || 0)) {
        existingCluster.priority_score = item.priority_score;
      }
    }
  }

  return clusteredZones;
};

/**
 * Menghitung statistik dampak untuk bar atas Peta Publik
 */
exports.getImpactStats = async () => {
  const [{ data: hotspots, error: hsErr }, { data: tasks }] = await Promise.all([
    supabaseAdmin.from('hotspots').select('id, status'),
    supabaseAdmin.from('cleanup_tasks').select('actual_weight_kg').eq('status', 'approved')
  ]);

  if (hsErr) throw hsErr;

  const active_hotspots = (hotspots || []).filter((h) => h.status !== 'resolved').length;
  const resolved_hotspots = (hotspots || []).filter((h) => h.status === 'resolved').length;
  const total_collected_weight_kg = (tasks || []).reduce(
    (sum, t) => sum + (Number(t.actual_weight_kg) || 0),
    0
  );

  return {
    active_hotspots,
    resolved_hotspots,
    total_collected_weight_kg
  };
};