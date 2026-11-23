import React, { useEffect, useMemo, useState } from 'react';
import { MapContainer, TileLayer, Circle, CircleMarker, Tooltip, useMap } from 'react-leaflet';
import 'leaflet/dist/leaflet.css';
import { publicApi } from '../api';

const LEVEL_COLORS = {
  parah: '#dc2626',   // Merah
  sedang: '#f59e0b',  // Oranye
  ringan: '#16a34a'   // Hijau
};

// Hitung jarak 2 titik koordinat dalam meter (Rumus Haversine)
function getDistanceMeters(lat1, lon1, lat2, lon2) {
  const R = 6371000;
  const toRad = (deg) => (deg * Math.PI) / 180;
  const dLat = toRad(lat2 - lat1);
  const dLon = toRad(lon2 - lon1);
  const a =
    Math.sin(dLat / 2) ** 2 +
    Math.cos(toRad(lat1)) * Math.cos(toRad(lat2)) * Math.sin(dLon / 2) ** 2;
  return 2 * R * Math.atan2(Math.sqrt(a), Math.sqrt(1 - a));
}

function formatDistance(meters) {
  if (meters == null) return '';
  if (meters < 1000) return `${Math.round(meters)} m`;
  return `${(meters / 1000).toFixed(2)} km`;
}

// Komponen pembantu agar peta menggeser kamera ke titik data sampah atau pilihan pencarian
function MapRecenter({ center }) {
  const map = useMap();
  useEffect(() => {
    if (center && center.length === 2) {
      map.setView(center, map.getZoom(), { animate: true });
    }
  }, [center, map]);
  return null;
}

export default function MapPage({ goReport }) {
  const [hotspots, setHotspots] = useState([]);
  const [stats, setStats] = useState(null);
  const [filterLevel, setFilterLevel] = useState('');
  const [loading, setLoading] = useState(true);
  const [selectedZone, setSelectedZone] = useState(null);

  // State lokasi user real-time & pencarian lokasi terdekat
  const [userPos, setUserPos] = useState(null);
  const [searchQuery, setSearchQuery] = useState('');
  const [searchOpen, setSearchOpen] = useState(false);
  const [manualCenter, setManualCenter] = useState(null);

  const defaultCenter = [-7.3305, 110.5084];

  // Pantau lokasi user secara real-time (tanpa menghilangkan fokus dari data sampah)
  useEffect(() => {
    if (!navigator.geolocation) return;
    const watchId = navigator.geolocation.watchPosition(
      (pos) => {
        setUserPos({
          lat: pos.coords.latitude,
          lng: pos.coords.longitude,
          accuracy: pos.coords.accuracy
        });
      },
      () => {},
      { enableHighAccuracy: true, maximumAge: 5000, timeout: 15000 }
    );
    return () => navigator.geolocation.clearWatch(watchId);
  }, []);

  const loadMapData = async () => {
    try {
      setLoading(true);
      const [hsRes, stRes] = await Promise.all([
        publicApi.getHotspots(filterLevel),
        publicApi.getStats()
      ]);
      setHotspots(hsRes.hotspots || []);
      setStats(stRes.stats || null);
    } catch (err) {
      console.error('Gagal memuat peta:', err.message);
    } finally {
      setLoading(false);
    }
  };

  useEffect(() => {
    loadMapData();
  }, [filterLevel]);

  // Urutkan hotspot berdasarkan jarak terdekat dari user
  const sortedHotspots = useMemo(() => {
    const list = hotspots.map((z) => ({
      ...z,
      distanceMeters: userPos
        ? getDistanceMeters(userPos.lat, userPos.lng, z.latitude, z.longitude)
        : null
    }));
    if (userPos) {
      list.sort((a, b) => a.distanceMeters - b.distanceMeters);
    }
    return list;
  }, [hotspots, userPos]);

  // Hasil pencarian yang otomatis direkomendasikan dari yang paling dekat dengan user
  const recommendedZones = useMemo(() => {
    const q = searchQuery.trim().toLowerCase();
    const filtered = q
      ? sortedHotspots.filter(
          (z) =>
            z.title?.toLowerCase().includes(q) ||
            z.primary_category?.toLowerCase().includes(q)
        )
      : sortedHotspots;
    return filtered.slice(0, 6);
  }, [sortedHotspots, searchQuery]);

  // Tetap prioritaskan koordinat data sampah (hotspots[0]) seperti kode asli Anda
  const mapCenter = manualCenter
    ? manualCenter
    : hotspots.length > 0
      ? [hotspots[0].latitude, hotspots[0].longitude]
      : userPos
        ? [userPos.lat, userPos.lng]
        : defaultCenter;

  return (
    <div style={{ display: 'flex', flexDirection: 'column', height: 'calc(100vh - 105px)', position: 'relative' }}>
      {/* Bar Statistik & Filter */}
      <div
        style={{
          padding: '10px 16px',
          background: '#f1f5f9',
          borderBottom: '1px solid #cbd5e1',
          display: 'flex',
          justifyContent: 'space-between',
          alignItems: 'center',
          flexWrap: 'wrap',
          gap: '10px',
          zIndex: 1050
        }}
      >
        <div style={{ display: 'flex', gap: '14px', fontSize: '0.85rem', alignItems: 'center', flexWrap: 'wrap' }}>
          <span>Zona Area: <b>{hotspots.length}</b></span>
          <span>Aktif: <b style={{ color: '#dc2626' }}>{stats?.active_hotspots ?? 0}</b></span>
          <span>Selesai: <b style={{ color: '#16a34a' }}>{stats?.resolved_hotspots ?? 0}</b></span>
          <span>Terkumpul: <b>{stats?.total_collected_weight_kg ?? 0} kg</b></span>
        </div>

        <div style={{ display: 'flex', gap: '8px', alignItems: 'center', flexWrap: 'wrap' }}>
          {/* Kolom Cari Lokasi dengan Rekomendasi Terdekat */}
          <div style={{ position: 'relative', minWidth: '220px' }}>
            <input
              type="text"
              value={searchQuery}
              onFocus={() => setSearchOpen(true)}
              onBlur={() => setTimeout(() => setSearchOpen(false), 180)}
              onChange={(e) => {
                setSearchQuery(e.target.value);
                setSearchOpen(true);
              }}
              placeholder="Cari lokasi (rekomendasi terdekat)..."
              style={{ width: '100%', padding: '5px 8px', borderRadius: '6px', border: '1px solid #94a3b8', fontSize: '0.85rem', background: '#fff' }}
            />

            {searchOpen && (
              <div
                style={{
                  position: 'absolute',
                  top: '110%',
                  left: 0,
                  minWidth: '280px',
                  background: '#fff',
                  border: '1px solid #cbd5e1',
                  borderRadius: '8px',
                  boxShadow: '0 8px 20px rgba(0,0,0,0.16)',
                  zIndex: 1200,
                  overflow: 'hidden'
                }}
              >
                <div style={{ padding: '6px 10px', background: '#f8fafc', borderBottom: '1px solid #e2e8f0', fontSize: '0.75rem', fontWeight: '700', color: '#0f766e' }}>
                  {userPos ? 'Rekomendasi Lokasi Terdekat dari Anda' : 'Daftar Lokasi Sampah'}
                </div>
                {recommendedZones.length === 0 ? (
                  <div style={{ padding: '10px', fontSize: '0.82rem', color: '#64748b' }}>Lokasi tidak ditemukan.</div>
                ) : (
                  recommendedZones.map((zone, idx) => (
                    <div
                      key={zone.id}
                      onMouseDown={() => {
                        setManualCenter([zone.latitude, zone.longitude]);
                        setSelectedZone(zone);
                        setSearchOpen(false);
                      }}
                      style={{
                        padding: '8px 10px',
                        borderBottom: '1px solid #f1f5f9',
                        cursor: 'pointer',
                        display: 'flex',
                        justifyContent: 'space-between',
                        alignItems: 'center',
                        gap: '8px',
                        background: idx === 0 && userPos ? '#f0fdfa' : '#fff'
                      }}
                    >
                      <div style={{ overflow: 'hidden' }}>
                        <div style={{ fontWeight: '700', fontSize: '0.83rem', color: '#0f172a', whiteSpace: 'nowrap', overflow: 'hidden', textOverflow: 'ellipsis' }}>
                          {idx === 0 && userPos ? '⭐ ' : ''}{zone.title}
                        </div>
                        <div style={{ fontSize: '0.74rem', color: '#64748b' }}>
                          Prioritas: {zone.priority_level?.toUpperCase()}
                        </div>
                      </div>
                      {zone.distanceMeters != null && (
                        <span style={{ fontSize: '0.74rem', fontWeight: '700', padding: '2px 7px', borderRadius: '99px', background: idx === 0 ? '#0f766e' : '#e2e8f0', color: idx === 0 ? '#fff' : '#334155', flexShrink: 0 }}>
                          {formatDistance(zone.distanceMeters)}
                        </span>
                      )}
                    </div>
                  ))
                )}
              </div>
            )}
          </div>

          <select
            value={filterLevel}
            onChange={(e) => {
              setManualCenter(null);
              setFilterLevel(e.target.value);
            }}
            style={{ padding: '5px 8px', borderRadius: '6px', border: '1px solid #94a3b8', fontSize: '0.85rem', background: '#fff' }}
          >
            <option value="">Semua Tingkat Prioritas</option>
            <option value="parah">Parah (Skor ≥ 70)</option>
            <option value="sedang">Sedang (Skor 40–69)</option>
            <option value="ringan">Ringan (Skor &lt; 40)</option>
          </select>

          <button
            onClick={() => {
              setManualCenter(null);
              loadMapData();
            }}
            style={{
              padding: '5px 10px',
              borderRadius: '6px',
              border: '1px solid #0f766e',
              background: '#fff',
              color: '#0f766e',
              cursor: 'pointer',
              fontSize: '0.85rem',
              fontWeight: '600'
            }}
          >
            Refresh
          </button>

          {typeof goReport === 'function' && (
            <button
              onClick={goReport}
              style={{
                padding: '5px 12px',
                borderRadius: '6px',
                border: 'none',
                background: '#0f766e',
                color: '#fff',
                cursor: 'pointer',
                fontSize: '0.85rem',
                fontWeight: '600'
              }}
            >
              + Laporkan
            </button>
          )}
        </div>
      </div>

      {/* Kontainer Peta */}
      <div style={{ flex: 1, width: '100%', minHeight: '420px', position: 'relative' }}>
        {loading && (
          <div
            style={{
              position: 'absolute',
              top: 10,
              left: '50%',
              transform: 'translateX(-50%)',
              zIndex: 1000,
              background: '#fff',
              padding: '4px 12px',
              borderRadius: '20px',
              boxShadow: '0 2px 6px rgba(0,0,0,0.15)',
              fontSize: '0.8rem'
            }}
          >
            Memuat zona sampah...
          </div>
        )}

        <MapContainer center={mapCenter} zoom={17} style={{ height: '100%', width: '100%' }}>
          <MapRecenter center={mapCenter} />
          <TileLayer
            attribution='&copy; OpenStreetMap contributors'
            url="https://{s}.tile.openstreetmap.org/{z}/{x}/{y}.png"
          />

          {/* Lokasi User Real-Time */}
          {userPos && (
            <>
              <Circle
                center={[userPos.lat, userPos.lng]}
                radius={Math.min(userPos.accuracy || 20, 60)}
                pathOptions={{ color: '#2563eb', weight: 1, fillColor: '#3b82f6', fillOpacity: 0.15 }}
              />
              <CircleMarker
                center={[userPos.lat, userPos.lng]}
                radius={8}
                pathOptions={{ color: '#ffffff', weight: 2.5, fillColor: '#2563eb', fillOpacity: 1 }}
              >
                <Tooltip direction="top" offset={[0, -6]} opacity={0.95}>
                  <b>Lokasi Anda Saat Ini</b> (±{Math.round(userPos.accuracy)} m)
                </Tooltip>
              </CircleMarker>
            </>
          )}

          {/* Lingkaran Data Sampah */}
          {sortedHotspots.map((zone) => {
            const color = zone.status === 'resolved' ? '#64748b' : (LEVEL_COLORS[zone.priority_level] || '#f59e0b');
            const photoCount = zone.photos?.length || zone.total_hotspots || 1;

            return (
              <Circle
                key={zone.id}
                center={[zone.latitude, zone.longitude]}
                radius={25}
                pathOptions={{
                  color,
                  weight: 2.5,
                  fillColor: color,
                  fillOpacity: zone.status === 'resolved' ? 0.25 : 0.45
                }}
                eventHandlers={{
                  click: () => setSelectedZone(zone)
                }}
              >
                <Tooltip direction="top" offset={[0, -5]} opacity={0.95}>
                  <span style={{ fontWeight: 'bold' }}>{zone.title}</span>
                  {zone.distanceMeters != null && ` (${formatDistance(zone.distanceMeters)})`}
                  {` (${photoCount} Foto Laporan) — Klik untuk detail`}
                </Tooltip>
              </Circle>
            );
          })}
        </MapContainer>

        {/* Legenda Warna Peta + Tombol Lokasi Saya */}
        <div
          style={{
            position: 'absolute',
            top: 12,
            right: 12,
            zIndex: 999,
            display: 'flex',
            flexDirection: 'column',
            gap: '8px',
            alignItems: 'flex-end'
          }}
        >
          {userPos && (
            <button
              onClick={() => setManualCenter([userPos.lat, userPos.lng])}
              style={{
                padding: '6px 10px',
                borderRadius: '8px',
                border: '1px solid #cbd5e1',
                background: '#fff',
                color: '#1d4ed8',
                fontWeight: '700',
                fontSize: '0.78rem',
                cursor: 'pointer',
                boxShadow: '0 2px 8px rgba(0,0,0,0.12)'
              }}
            >
              🎯 Lokasi Saya
            </button>
          )}

          <div
            style={{
              background: 'rgba(255,255,255,0.95)',
              padding: '8px 12px',
              borderRadius: '8px',
              boxShadow: '0 2px 8px rgba(0,0,0,0.12)',
              fontSize: '0.78rem'
            }}
          >
            <div style={{ fontWeight: '700', marginBottom: '4px', color: '#0f172a' }}>Skala Dampak</div>
            <div style={{ display: 'flex', alignItems: 'center', gap: '6px', marginBottom: '2px' }}>
              <span style={{ width: 9, height: 9, borderRadius: '50%', background: '#2563eb', display: 'inline-block' }} /> Lokasi Anda
            </div>
            <div style={{ display: 'flex', alignItems: 'center', gap: '6px', marginBottom: '2px' }}>
              <span style={{ width: 9, height: 9, borderRadius: '50%', background: '#dc2626', display: 'inline-block' }} /> Parah
            </div>
            <div style={{ display: 'flex', alignItems: 'center', gap: '6px', marginBottom: '2px' }}>
              <span style={{ width: 9, height: 9, borderRadius: '50%', background: '#f59e0b', display: 'inline-block' }} /> Sedang
            </div>
            <div style={{ display: 'flex', alignItems: 'center', gap: '6px', marginBottom: '2px' }}>
              <span style={{ width: 9, height: 9, borderRadius: '50%', background: '#16a34a', display: 'inline-block' }} /> Ringan
            </div>
            <div style={{ display: 'flex', alignItems: 'center', gap: '6px' }}>
              <span style={{ width: 9, height: 9, borderRadius: '50%', background: '#64748b', display: 'inline-block' }} /> Selesai
            </div>
          </div>
        </div>

        {/* Panel Detail & Galeri Foto Saat Lingkaran Lokasi Ditekan */}
        {selectedZone && (
          <div
            style={{
              position: 'absolute',
              bottom: '16px',
              left: '50%',
              transform: 'translateX(-50%)',
              width: '92%',
              maxWidth: '520px',
              maxHeight: '65vh',
              overflowY: 'auto',
              background: '#fff',
              borderRadius: '12px',
              boxShadow: '0 10px 25px rgba(0,0,0,0.25)',
              padding: '16px',
              zIndex: 1001,
              border: '1px solid #cbd5e1'
            }}
          >
            <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'flex-start', gap: '8px' }}>
              <div>
                <h3 style={{ margin: 0, fontSize: '1.05rem', color: '#0f172a' }}>{selectedZone.title}</h3>
                <p style={{ margin: '4px 0 0 0', fontSize: '0.8rem', color: '#64748b' }}>
                  Koordinat: {selectedZone.latitude.toFixed(5)}, {selectedZone.longitude.toFixed(5)}
                  {selectedZone.distanceMeters != null && (
                    <span style={{ color: '#0f766e', fontWeight: '700' }}> · Jarak {formatDistance(selectedZone.distanceMeters)} dari Anda</span>
                  )}
                </p>
              </div>
              <button
                onClick={() => setSelectedZone(null)}
                style={{ background: '#e2e8f0', border: 'none', borderRadius: '6px', padding: '4px 10px', cursor: 'pointer', fontWeight: 'bold' }}
              >
                ✕ Tutup
              </button>
            </div>

            <div style={{ display: 'flex', gap: '8px', flexWrap: 'wrap', margin: '10px 0', fontSize: '0.8rem' }}>
              <span style={{ padding: '3px 8px', borderRadius: '4px', background: '#fef3c7', color: '#b45309', fontWeight: 'bold' }}>
                Prioritas: {selectedZone.priority_level?.toUpperCase()} (Skor {selectedZone.priority_score})
              </span>
              <span style={{ padding: '3px 8px', borderRadius: '4px', background: '#e0f2fe', color: '#0369a1' }}>
                Kategori: {selectedZone.primary_category}
              </span>
              <span style={{ padding: '3px 8px', borderRadius: '4px', background: '#f1f5f9', color: '#334155' }}>
                Total Bukti Foto: {selectedZone.photos?.length || 0}
              </span>
            </div>

            <h4 style={{ margin: '12px 0 8px 0', fontSize: '0.9rem', borderTop: '1px solid #e2e8f0', paddingTop: '10px' }}>
              Galeri Foto Laporan di Area Ini
            </h4>

            {(!selectedZone.photos || selectedZone.photos.length === 0) ? (
              <p style={{ fontSize: '0.85rem', color: '#64748b' }}>Belum ada lampiran foto tersimpan untuk zona ini.</p>
            ) : (
              <div style={{ display: 'grid', gridTemplateColumns: 'repeat(auto-fill, minmax(140px, 1fr))', gap: '10px' }}>
                {selectedZone.photos.map((photo, idx) => (
                  <div key={photo.id || idx} style={{ border: '1px solid #e2e8f0', borderRadius: '8px', overflow: 'hidden', background: '#f8fafc' }}>
                    {photo.photo_url ? (
                      <a href={photo.photo_url} target="_blank" rel="noreferrer">
                        <img
                          src={photo.photo_url}
                          alt={`Bukti ${idx + 1}`}
                          style={{ width: '100%', height: '110px', objectFit: 'cover', display: 'block' }}
                        />
                      </a>
                    ) : (
                      <div style={{ height: '110px', display: 'flex', alignItems: 'center', justifyContent: 'center', fontSize: '0.75rem', color: '#94a3b8' }}>
                        Foto tidak tersedia
                      </div>
                    )}
                    <div style={{ padding: '6px', fontSize: '0.75rem' }}>
                      <div style={{ fontWeight: 'bold', textTransform: 'uppercase', color: '#d97706' }}>
                        {photo.severity}
                      </div>
                      <div style={{ color: '#475569', marginTop: '2px' }}>
                        {new Date(photo.created_at).toLocaleDateString('id-ID', { day: 'numeric', month: 'short', hour: '2-digit', minute: '2-digit' })}
                      </div>
                      {photo.description && (
                        <div style={{ color: '#64748b', marginTop: '2px', whiteSpace: 'nowrap', overflow: 'hidden', textOverflow: 'ellipsis' }}>
                          {photo.description}
                        </div>
                      )}
                    </div>
                  </div>
                ))}
              </div>
            )}
          </div>
        )}
      </div>
    </div>
  );
}