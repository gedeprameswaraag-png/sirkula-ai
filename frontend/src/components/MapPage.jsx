import React, { useEffect, useMemo, useRef, useState } from 'react';
import { MapContainer, TileLayer, Circle, CircleMarker, Tooltip, useMap } from 'react-leaflet';
import 'leaflet/dist/leaflet.css';
import { publicApi } from '../api';
import { supabase } from '../supabaseClient';

const API_BASE = import.meta.env.VITE_API_URL || '/api';

const LEVEL_COLORS = {
  parah: '#dc2626',   // Merah
  sedang: '#f59e0b',  // Oranye
  ringan: '#16a34a'   // Hijau
};

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

function MapRecenter({ center }) {
  const map = useMap();
  const lastCenteredRef = useRef('');

  useEffect(() => {
    if (center && center.length === 2) {
      const key = `${center[0].toFixed(5)},${center[1].toFixed(5)}`;
      if (lastCenteredRef.current !== key) {
        lastCenteredRef.current = key;
        map.setView(center, 17, { animate: true });
      }
    }
  }, [center, map]);

  return null;
}

export default function MapPage({
  currentUser,
  focusedZone,
  onClearFocusedZone,
  goReport,
  goVolunteerAuth,
  onTaskClaimed
}) {
  const [hotspots, setHotspots] = useState([]);
  const [stats, setStats] = useState(null);
  const [filterLevel, setFilterLevel] = useState('');
  const [loading, setLoading] = useState(true);
  const [selectedZone, setSelectedZone] = useState(focusedZone || null);

  // State lokasi user real-time & pencarian lokasi terdekat
  const [userPos, setUserPos] = useState(null);
  const [searchQuery, setSearchQuery] = useState('');
  const [searchOpen, setSearchOpen] = useState(false);
  const [manualCenter, setManualCenter] = useState(
    focusedZone ? [focusedZone.latitude, focusedZone.longitude] : null
  );

  // State pengambilan tugas oleh relawan
  const [myGroups, setMyGroups] = useState([]);
  const [selectedGroupId, setSelectedGroupId] = useState('');
  const [claiming, setClaiming] = useState(false);
  const [claimMsg, setClaimMsg] = useState('');

  const defaultCenter = [-7.3305, 110.5084];

  // Sinkronkan jika ada titik tugas yang dikirim dari Dashboard Relawan
  useEffect(() => {
    if (focusedZone) {
      setSelectedZone(focusedZone);
      setManualCenter([focusedZone.latitude, focusedZone.longitude]);
      setClaimMsg('');
    }
  }, [focusedZone]);

  // Pantau lokasi user secara real-time
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

  // Muat daftar grup relawan jika user sedang login sebagai volunteer
  useEffect(() => {
    if (currentUser?.role !== 'volunteer') return;
    (async () => {
      try {
        const { data: { session } } = await supabase.auth.getSession();
        if (!session?.access_token) return;
        const res = await fetch(`${API_BASE}/volunteer/dashboard`, {
          headers: { Authorization: `Bearer ${session.access_token}` }
        });
        const data = await res.json();
        if (res.ok && data.my_groups) {
          setMyGroups(data.my_groups);
        }
      } catch {
        // Abaikan jika gagal memuat grup
      }
    })();
  }, [currentUser]);

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

  // Perbarui jarak pada selectedZone secara real-time saat GPS bergerak
  const activeZone = useMemo(() => {
    if (!selectedZone) return null;
    const distanceMeters = userPos
      ? getDistanceMeters(userPos.lat, userPos.lng, selectedZone.latitude, selectedZone.longitude)
      : selectedZone.distanceMeters ?? null;
    return { ...selectedZone, distanceMeters };
  }, [selectedZone, userPos]);

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

  // Prioritaskan pilihan manual (dari dashboard/pencarian) -> lokasi GPS user -> titik terdekat -> default
  const mapCenter = manualCenter
    ? manualCenter
    : userPos
      ? [userPos.lat, userPos.lng]
      : sortedHotspots.length > 0
        ? [sortedHotspots[0].latitude, sortedHotspots[0].longitude]
        : defaultCenter;

  // Fungsi ambil tugas langsung dari panel peta
  const handleClaimTaskFromMap = async (zone) => {
    try {
      setClaiming(true);
      setClaimMsg('');
      const { data: { session } } = await supabase.auth.getSession();
      const res = await fetch(`${API_BASE}/volunteer/hotspots/${zone.id}/claim`, {
        method: 'POST',
        headers: {
          'Content-Type': 'application/json',
          ...(session?.access_token ? { Authorization: `Bearer ${session.access_token}` } : {})
        },
        body: JSON.stringify({ group_id: selectedGroupId || null })
      });
      const data = await res.json();
      if (!res.ok) throw new Error(data.message || 'Gagal mengambil tugas.');

      setClaimMsg('Tugas pembersihan berhasil diambil! Membuka Riwayat Tugas...');
      await loadMapData();
      if (typeof onTaskClaimed === 'function') {
        setTimeout(() => onTaskClaimed(), 900);
      }
    } catch (err) {
      setClaimMsg(err.message);
    } finally {
      setClaiming(false);
    }
  };

  // URL Google Maps Rute dari lokasi GPS pengguna ke titik sampah
  const buildDirectionsUrl = (zone) => {
    const dest = `${zone.latitude},${zone.longitude}`;
    if (userPos) {
      const origin = `${userPos.lat},${userPos.lng}`;
      return `https://www.google.com/maps/dir/?api=1&origin=${origin}&destination=${dest}&travelmode=walking`;
    }
    return `https://www.google.com/maps/dir/?api=1&destination=${dest}`;
  };

  const isVolunteer = currentUser?.role === 'volunteer' || ['admin', 'super_admin'].includes(currentUser?.role);
  const isVerifiedVolunteer = currentUser?.volunteer_status === 'verified' || ['admin', 'super_admin'].includes(currentUser?.role);

  return (
    <div className="map-page-shell" style={{ display: 'flex', flexDirection: 'column', height: 'calc(100vh - 105px)', position: 'relative' }}>
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
                        setClaimMsg('');
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
            onChange={(e) => setFilterLevel(e.target.value)}
            style={{ padding: '5px 8px', borderRadius: '6px', border: '1px solid #94a3b8', fontSize: '0.85rem', background: '#fff' }}
          >
            <option value="">Semua Tingkat Prioritas</option>
            <option value="parah">Parah (Skor ≥ 70)</option>
            <option value="sedang">Sedang (Skor 40–69)</option>
            <option value="ringan">Ringan (Skor &lt; 40)</option>
          </select>

          <button
            onClick={loadMapData}
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
            const isSelected = activeZone?.id === zone.id;

            return (
              <Circle
                key={zone.id}
                center={[zone.latitude, zone.longitude]}
                radius={isSelected ? 32 : 25}
                pathOptions={{
                  color: isSelected ? '#0f172a' : color,
                  weight: isSelected ? 3.5 : 2.5,
                  fillColor: color,
                  fillOpacity: zone.status === 'resolved' ? 0.25 : 0.5
                }}
                eventHandlers={{
                  click: () => {
                    setSelectedZone(zone);
                    setClaimMsg('');
                  }
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
              onClick={() => setManualCenter([userPos.lat + Math.random() * 0.000001, userPos.lng])}
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

        {/* Panel Detail, Petunjuk Lokasi, Ambil Tugas / Ajakan Relawan & Galeri Foto */}
        {activeZone && (
          <div
            style={{
              position: 'absolute',
              bottom: '16px',
              left: '50%',
              transform: 'translateX(-50%)',
              width: '92%',
              maxWidth: '540px',
              maxHeight: '72vh',
              overflowY: 'auto',
              background: '#fff',
              borderRadius: '14px',
              boxShadow: '0 12px 30px rgba(0,0,0,0.28)',
              padding: '16px',
              zIndex: 1001,
              border: '1px solid #cbd5e1'
            }}
          >
            {/* Header Titik */}
            <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'flex-start', gap: '8px' }}>
              <div>
                <h3 style={{ margin: 0, fontSize: '1.08rem', color: '#0f172a' }}>{activeZone.title}</h3>
                <p style={{ margin: '4px 0 0 0', fontSize: '0.8rem', color: '#64748b' }}>
                  Koordinat: {activeZone.latitude.toFixed(5)}, {activeZone.longitude.toFixed(5)}
                  {activeZone.distanceMeters != null && (
                    <span style={{ color: '#0f766e', fontWeight: '700' }}> · Jarak {formatDistance(activeZone.distanceMeters)} dari Anda</span>
                  )}
                </p>
              </div>
              <button
                onClick={() => {
                  setSelectedZone(null);
                  setClaimMsg('');
                  if (typeof onClearFocusedZone === 'function') onClearFocusedZone();
                }}
                style={{ background: '#e2e8f0', border: 'none', borderRadius: '6px', padding: '5px 10px', cursor: 'pointer', fontWeight: 'bold' }}
              >
                ✕ Tutup
              </button>
            </div>

            {/* Badge Status */}
            <div style={{ display: 'flex', gap: '8px', flexWrap: 'wrap', margin: '10px 0', fontSize: '0.8rem' }}>
              <span style={{ padding: '3px 8px', borderRadius: '4px', background: '#fef3c7', color: '#b45309', fontWeight: 'bold' }}>
                Prioritas: {activeZone.priority_level?.toUpperCase()} (Skor {activeZone.priority_score})
              </span>
              <span style={{ padding: '3px 8px', borderRadius: '4px', background: '#e0f2fe', color: '#0369a1' }}>
                Kategori: {activeZone.primary_category}
              </span>
              <span style={{ padding: '3px 8px', borderRadius: '4px', background: '#f1f5f9', color: '#334155' }}>
                Bukti Foto: {activeZone.photos?.length || 0}
              </span>
            </div>

            {/* Petunjuk Arah & Aksi Pembersihan */}
            <div style={{ background: '#f8fafc', border: '1px solid #e2e8f0', borderRadius: '10px', padding: '12px', margin: '10px 0', display: 'flex', flexDirection: 'column', gap: '10px' }}>
              <a
                href={buildDirectionsUrl(activeZone)}
                target="_blank"
                rel="noreferrer"
                style={{
                  display: 'flex',
                  alignItems: 'center',
                  justifyContent: 'center',
                  gap: '6px',
                  width: '100%',
                  padding: '9px',
                  borderRadius: '8px',
                  border: '1px solid #2563eb',
                  background: '#eff6ff',
                  color: '#1d4ed8',
                  fontWeight: '700',
                  fontSize: '0.86rem',
                  textDecoration: 'none',
                  boxSizing: 'border-box'
                }}
              >
                🧭 Petunjuk Lokasi & Rute Google Maps ↗
              </a>

              {claimMsg && (
                <div style={{ padding: '8px 10px', borderRadius: '6px', fontSize: '0.82rem', fontWeight: '600', background: claimMsg.includes('berhasil') ? '#dcfce7' : '#fee2e2', color: claimMsg.includes('berhasil') ? '#166534' : '#b91c1c' }}>
                  {claimMsg}
                </div>
              )}

              {activeZone.status === 'resolved' ? (
                <div style={{ textAlign: 'center', fontSize: '0.84rem', fontWeight: '700', color: '#16a34a', padding: '4px' }}>
                  ✓ Titik sampah ini sudah selesai dibersihkan.
                </div>
              ) : isVolunteer ? (
                <div style={{ display: 'flex', flexDirection: 'column', gap: '8px' }}>
                  {myGroups.length > 0 && (
                    <select
                      value={selectedGroupId}
                      onChange={(e) => setSelectedGroupId(e.target.value)}
                      style={{ width: '100%', padding: '7px 10px', borderRadius: '8px', border: '1px solid #cbd5e1', fontSize: '0.84rem', background: '#fff' }}
                    >
                      <option value="">Kerjakan Sebagai Individu</option>
                      {myGroups.map((g) => (
                        <option key={g.id} value={g.id}>Kerjakan Bersama Grup: {g.name}</option>
                      ))}
                    </select>
                  )}

                  <button
                    type="button"
                    disabled={!isVerifiedVolunteer || claiming}
                    onClick={() => handleClaimTaskFromMap(activeZone)}
                    style={{
                      width: '100%',
                      padding: '10px',
                      borderRadius: '8px',
                      border: 'none',
                      background: isVerifiedVolunteer ? '#0f766e' : '#cbd5e1',
                      color: isVerifiedVolunteer ? '#fff' : '#475569',
                      fontWeight: '700',
                      fontSize: '0.9rem',
                      cursor: isVerifiedVolunteer && !claiming ? 'pointer' : 'not-allowed'
                    }}
                  >
                    {!isVerifiedVolunteer
                      ? '⏳ Akun Anda Menunggu Verifikasi Admin'
                      : claiming
                        ? 'Mengambil Tugas...'
                        : '🧹 Ambil Tugas Pembersihan Ini'}
                  </button>
                </div>
              ) : (
                <div style={{ background: '#f0fdfa', border: '1px solid #99f6e4', borderRadius: '8px', padding: '10px 12px', display: 'flex', justifyContent: 'space-between', alignItems: 'center', flexWrap: 'wrap', gap: '8px' }}>
                  <div>
                    <div style={{ fontWeight: '700', fontSize: '0.88rem', color: '#0f766e' }}>
                      Ingin menjadi relawan?
                    </div>
                    <div style={{ fontSize: '0.78rem', color: '#334155' }}>
                      Daftar atau masuk untuk ikut membersihkan titik sampah ini.
                    </div>
                  </div>
                  {typeof goVolunteerAuth === 'function' && (
                    <button
                      type="button"
                      onClick={goVolunteerAuth}
                      style={{
                        padding: '7px 12px',
                        borderRadius: '8px',
                        border: 'none',
                        background: '#0f766e',
                        color: '#fff',
                        fontWeight: '700',
                        fontSize: '0.82rem',
                        cursor: 'pointer'
                      }}
                    >
                      Gabung Relawan →
                    </button>
                  )}
                </div>
              )}
            </div>

            {/* Galeri Foto */}
            <h4 style={{ margin: '10px 0 8px 0', fontSize: '0.88rem', borderTop: '1px solid #e2e8f0', paddingTop: '10px' }}>
              Galeri Foto Laporan di Area Ini
            </h4>

            {(!activeZone.photos || activeZone.photos.length === 0) ? (
              <p style={{ fontSize: '0.85rem', color: '#64748b' }}>Belum ada lampiran foto tersimpan untuk zona ini.</p>
            ) : (
              <div style={{ display: 'grid', gridTemplateColumns: 'repeat(auto-fill, minmax(140px, 1fr))', gap: '10px' }}>
                {activeZone.photos.map((photo, idx) => (
                  <div key={photo.id || idx} style={{ border: '1px solid #e2e8f0', borderRadius: '8px', overflow: 'hidden', background: '#f8fafc' }}>
                    {photo.photo_url ? (
                      <a href={photo.photo_url} target="_blank" rel="noreferrer">
                        <img
                          src={photo.photo_url}
                          alt={`Bukti ${idx + 1}`}
                          style={{ width: '100%', height: '105px', objectFit: 'cover', display: 'block' }}
                        />
                      </a>
                    ) : (
                      <div style={{ height: '105px', display: 'flex', alignItems: 'center', justifyContent: 'center', fontSize: '0.75rem', color: '#94a3b8' }}>
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