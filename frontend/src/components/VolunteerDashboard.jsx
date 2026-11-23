import React, { useEffect, useMemo, useState } from 'react';
import { supabase } from '../supabaseClient';
import CommunityHub from './CommunityHub.jsx';

const API_BASE = import.meta.env.VITE_API_URL || '/api';

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

async function volFetch(endpoint, options = {}) {
  const { data: { session } } = await supabase.auth.getSession();
  const headers = {
    ...(options.headers || {}),
    ...(session?.access_token ? { Authorization: `Bearer ${session.access_token}` } : {})
  };
  if (!(options.body instanceof FormData) && !headers['Content-Type']) {
    headers['Content-Type'] = 'application/json';
  }
  const res = await fetch(`${API_BASE}${endpoint}`, { ...options, headers });
  const data = await res.json();
  if (!res.ok) throw new Error(data.message || 'Gagal memuat data.');
  return data;
}

export default function VolunteerDashboard({ currentUser, onLogout, onSelectHotspotOnMap }) {
  const [tab, setTab] = useState('tugas'); // tugas | riwayat | komunitas | profil
  const [profile, setProfile] = useState(currentUser);
  const [tasks, setTasks] = useState([]);
  const [hotspots, setHotspots] = useState([]);
  const [msg, setMsg] = useState('');
  const [userPos, setUserPos] = useState(null);
  const [hoveredCardId, setHoveredCardId] = useState(null);
  const [pressedCardId, setPressedCardId] = useState(null);

  // State form penyelesaian tugas
  const [completingTaskId, setCompletingTaskId] = useState(null);
  const [weightKg, setWeightKg] = useState('');
  const [proofNotes, setProofNotes] = useState('');
  const [proofFile, setProofFile] = useState(null);
  const [submittingProof, setSubmittingProof] = useState(false);

  // Pantau GPS relawan untuk mengurutkan titik terdekat
  useEffect(() => {
    if (!navigator.geolocation) return;
    const watchId = navigator.geolocation.watchPosition(
      (pos) => {
        setUserPos({
          lat: pos.coords.latitude,
          lng: pos.coords.longitude
        });
      },
      () => {},
      { enableHighAccuracy: true, maximumAge: 5000, timeout: 15000 }
    );
    return () => navigator.geolocation.clearWatch(watchId);
  }, []);

  const loadAll = async () => {
    try {
      const [dashRes, hsRes] = await Promise.all([
        volFetch('/volunteer/dashboard'),
        volFetch('/public/hotspots')
      ]);
      if (dashRes.profile) setProfile(dashRes.profile);
      setTasks(dashRes.tasks || []);
      setHotspots((hsRes.hotspots || []).filter((h) => h.status !== 'resolved'));
    } catch (err) {
      setMsg(err.message);
    }
  };

  useEffect(() => {
    loadAll();
  }, []);

  // Urutkan titik sampah dari yang terdekat dengan lokasi GPS relawan
  const sortedHotspots = useMemo(() => {
    const mapped = hotspots.map((hs) => ({
      ...hs,
      distanceMeters: userPos
        ? getDistanceMeters(userPos.lat, userPos.lng, hs.latitude, hs.longitude)
        : null
    }));
    if (userPos) {
      mapped.sort((a, b) => a.distanceMeters - b.distanceMeters);
    }
    return mapped;
  }, [hotspots, userPos]);

  const handleOpenTaskOnMap = (hs) => {
    setPressedCardId(hs.id);
    setTimeout(() => {
      if (typeof onSelectHotspotOnMap === 'function') {
        onSelectHotspotOnMap(hs);
      }
    }, 150);
  };

  const handleCompleteSubmit = async (e) => {
    e.preventDefault();
    if (!proofFile) {
      setMsg('Silakan pilih foto bukti area setelah dibersihkan terlebih dahulu.');
      return;
    }
    try {
      setSubmittingProof(true);
      const formData = new FormData();
      formData.append('image', proofFile);
      formData.append('actual_weight_kg', weightKg || '5');
      formData.append('completion_notes', proofNotes || 'Area sudah dibersihkan.');

      await volFetch(`/volunteer/tasks/${completingTaskId}/complete`, {
        method: 'POST',
        body: formData
      });

      setCompletingTaskId(null);
      setWeightKg('');
      setProofNotes('');
      setProofFile(null);
      setMsg('Bukti penyelesaian berhasil dikirim dan menunggu verifikasi Admin!');
      loadAll();
    } catch (err) {
      setMsg(err.message);
    } finally {
      setSubmittingProof(false);
    }
  };

  const isVerified = profile?.volunteer_status === 'verified';

  return (
    <div style={{ maxWidth: '1040px', margin: '0 auto', padding: '16px' }}>
      <style>{`
        @keyframes sirkulaFadeUp {
          from {
            opacity: 0;
            transform: translateY(12px);
          }
          to {
            opacity: 1;
            transform: translateY(0);
          }
        }
        .sirkula-task-card {
          animation: sirkulaFadeUp 0.35s ease-out both;
          transition: transform 0.22s cubic-bezier(0.22, 1, 0.36, 1),
                      box-shadow 0.22s ease,
                      border-color 0.22s ease,
                      background-color 0.22s ease;
        }
        .sirkula-task-btn {
          transition: background-color 0.2s ease, transform 0.15s ease;
        }
        .sirkula-task-card:hover .sirkula-task-btn {
          background-color: #115e59 !important;
        }
      `}</style>

      {/* Header Dashboard */}
      <div style={{ background: '#0f766e', color: '#fff', borderRadius: '12px', padding: '16px 20px', display: 'flex', justifyContent: 'space-between', alignItems: 'center', flexWrap: 'wrap', gap: '12px', marginBottom: '16px' }}>
        <div>
          <div style={{ fontSize: '0.8rem', opacity: 0.85 }}>Dashboard Sukarelawan</div>
          <h2 style={{ margin: '2px 0' }}>{profile?.full_name}</h2>
          <div style={{ display: 'flex', gap: '8px', marginTop: '4px', fontSize: '0.82rem', flexWrap: 'wrap' }}>
            <span style={{ background: 'rgba(255,255,255,0.2)', padding: '2px 10px', borderRadius: '99px', fontWeight: '700' }}>
              Level: {profile?.volunteer_level || 'Pemula'} ({profile?.experience_points || 0} XP)
            </span>
            <span style={{ background: isVerified ? '#16a34a' : '#f59e0b', padding: '2px 10px', borderRadius: '99px', fontWeight: '600' }}>
              {isVerified ? '✓ Terverifikasi' : '⏳ Menunggu Verifikasi Admin'}
            </span>
          </div>
        </div>
        <button onClick={onLogout} style={{ background: 'rgba(255,255,255,0.2)', color: '#fff', border: '1px solid rgba(255,255,255,0.4)', borderRadius: '8px', padding: '8px 14px', cursor: 'pointer', fontWeight: '600' }}>
          Keluar Akun
        </button>
      </div>

      {msg && (
        <div style={{ padding: '10px 14px', background: '#f0fdfa', border: '1px solid #99f6e4', color: '#0f766e', borderRadius: '8px', marginBottom: '14px', fontSize: '0.88rem', fontWeight: '600', display: 'flex', justifyContent: 'space-between', alignItems: 'center' }}>
          <span>{msg}</span>
          <button onClick={() => setMsg('')} style={{ background: 'none', border: 'none', color: '#0f766e', cursor: 'pointer', fontWeight: '700' }}>✕</button>
        </div>
      )}

      {/* Tab Navigasi */}
      <div style={{ display: 'flex', gap: '8px', flexWrap: 'wrap', marginBottom: '16px' }}>
        {[
          { id: 'tugas', label: `🧹 Ambil Tugas (${sortedHotspots.length})` },
          { id: 'riwayat', label: `📋 Riwayat Penyelesaian (${tasks.length})` },
          { id: 'komunitas', label: '💬 Komunitas & Grup' },
          { id: 'profil', label: '👤 Profil & Level' }
        ].map((t) => (
          <button
            key={t.id}
            onClick={() => setTab(t.id)}
            style={{
              padding: '9px 15px', borderRadius: '8px', border: 'none', cursor: 'pointer', fontWeight: '700', fontSize: '0.88rem',
              transition: 'all 0.2s ease',
              background: tab === t.id ? '#0f766e' : '#e2e8f0',
              color: tab === t.id ? '#fff' : '#334155'
            }}
          >
            {t.label}
          </button>
        ))}
      </div>

      {tab === 'tugas' && (
        <div style={{ background: '#fff', padding: '18px', borderRadius: '12px', border: '1px solid #e2e8f0' }}>
          <div style={{ marginBottom: '14px' }}>
            <h3 style={{ margin: 0 }}>Titik Sampah Siap Dibersihkan ({sortedHotspots.length})</h3>
            <p style={{ margin: '2px 0 0 0', fontSize: '0.82rem', color: '#64748b' }}>
              {userPos
                ? 'Diurutkan otomatis dari jarak terdekat dengan posisi GPS Anda. Tekan kartu untuk melihat lokasi di peta.'
                : 'Aktifkan GPS untuk melihat jarak terdekat dari posisi Anda.'}
            </p>
          </div>

          {sortedHotspots.length === 0 ? (
            <p style={{ color: '#64748b', fontSize: '0.9rem' }}>Belum ada titik lokasi terbuka yang menunggu pembersihan.</p>
          ) : (
            <div style={{ display: 'grid', gridTemplateColumns: 'repeat(auto-fill, minmax(270px, 1fr))', gap: '12px' }}>
              {sortedHotspots.map((hs, idx) => {
                const isHovered = hoveredCardId === hs.id;
                const isPressed = pressedCardId === hs.id;
                const isNearest = idx === 0 && userPos;

                return (
                  <div
                    key={hs.id}
                    role="button"
                    tabIndex={0}
                    className="sirkula-task-card"
                    onClick={() => handleOpenTaskOnMap(hs)}
                    onKeyDown={(e) => {
                      if (e.key === 'Enter' || e.key === ' ') handleOpenTaskOnMap(hs);
                    }}
                    onMouseEnter={() => setHoveredCardId(hs.id)}
                    onMouseLeave={() => setHoveredCardId(null)}
                    style={{
                      animationDelay: `${idx * 60}ms`,
                      border: isHovered ? '1.5px solid #0f766e' : '1px solid #e2e8f0',
                      borderRadius: '10px',
                      padding: '14px',
                      background: isHovered ? '#f0fdfa' : isNearest ? '#f0fdfa' : '#f8fafc',
                      display: 'flex',
                      flexDirection: 'column',
                      justifyContent: 'space-between',
                      gap: '12px',
                      cursor: 'pointer',
                      transform: isPressed
                        ? 'scale(0.97)'
                        : isHovered
                          ? 'translateY(-4px)'
                          : 'translateY(0)',
                      boxShadow: isHovered
                        ? '0 10px 20px rgba(15, 118, 110, 0.14)'
                        : '0 1px 3px rgba(15, 23, 42, 0.04)'
                    }}
                  >
                    <div>
                      <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'flex-start', gap: '6px' }}>
                        <div style={{ fontWeight: '700', color: '#0f172a' }}>{hs.title}</div>
                        {hs.distanceMeters != null && (
                          <span style={{ fontSize: '0.75rem', fontWeight: '700', padding: '2px 8px', borderRadius: '99px', background: isNearest ? '#0f766e' : '#e2e8f0', color: isNearest ? '#fff' : '#334155', flexShrink: 0 }}>
                            {formatDistance(hs.distanceMeters)}
                          </span>
                        )}
                      </div>
                      <div style={{ fontSize: '0.8rem', color: '#64748b', marginTop: '4px' }}>
                        Prioritas: <b>{hs.priority_level?.toUpperCase()}</b> · Bukti Foto: {hs.photos?.length || 1}
                      </div>
                    </div>

                    <button
                      type="button"
                      className="sirkula-task-btn"
                      onClick={(e) => {
                        e.stopPropagation();
                        handleOpenTaskOnMap(hs);
                      }}
                      style={{
                        width: '100%',
                        padding: '9px',
                        borderRadius: '8px',
                        border: 'none',
                        background: '#0f766e',
                        color: '#fff',
                        fontWeight: '700',
                        cursor: 'pointer'
                      }}
                    >
                      Ambil Tugas
                    </button>
                  </div>
                );
              })}
            </div>
          )}
        </div>
      )}

      {tab === 'riwayat' && (
        <div style={{ background: '#fff', padding: '18px', borderRadius: '12px', border: '1px solid #e2e8f0' }}>
          <h3 style={{ marginTop: 0 }}>Riwayat Penyelesaian Pekerjaan</h3>
          {tasks.length === 0 ? (
            <p style={{ color: '#64748b' }}>Belum ada riwayat pekerjaan.</p>
          ) : (
            <div style={{ display: 'grid', gap: '12px' }}>
              {tasks.map((t) => (
                <div key={t.id} style={{ padding: '14px', border: '1px solid #e2e8f0', borderRadius: '10px', background: '#f8fafc' }}>
                  <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center', flexWrap: 'wrap', gap: '8px' }}>
                    <div>
                      <strong>{t.hotspots?.title || 'Tugas Pembersihan'}</strong>
                      <div style={{ fontSize: '0.82rem', color: '#64748b' }}>
                        Status: <b>{t.status}</b> · Berat Terkumpul: {t.actual_weight_kg || 0} kg
                      </div>
                    </div>
                    <span style={{ fontWeight: '700', color: '#0f766e' }}>
                      {t.status === 'approved' ? `+${t.xp_awarded || 0} XP` : t.status === 'submitted' ? '⏳ Menunggu Verifikasi Admin' : 'Sedang Dikerjakan'}
                    </span>
                  </div>

                  {t.status === 'in_progress' && (
                    <div style={{ marginTop: '12px' }}>
                      {completingTaskId === t.id ? (
                        <form onSubmit={handleCompleteSubmit} style={{ background: '#fff', padding: '12px', borderRadius: '8px', border: '1px solid #cbd5e1', display: 'grid', gap: '10px' }}>
                          <div>
                            <label style={{ display: 'block', fontSize: '0.82rem', fontWeight: '600', marginBottom: '4px' }}>Foto Bukti Area Setelah Bersih *</label>
                            <input type="file" accept="image/*" required onChange={(e) => setProofFile(e.target.files?.[0] || null)} />
                          </div>
                          <div style={{ display: 'grid', gridTemplateColumns: '1fr 2fr', gap: '10px' }}>
                            <div>
                              <label style={{ display: 'block', fontSize: '0.82rem', fontWeight: '600', marginBottom: '4px' }}>Berat Sampah (kg)</label>
                              <input type="number" step="0.5" value={weightKg} onChange={(e) => setWeightKg(e.target.value)} placeholder="10" style={{ width: '100%', padding: '7px', borderRadius: '6px', border: '1px solid #cbd5e1' }} />
                            </div>
                            <div>
                              <label style={{ display: 'block', fontSize: '0.82rem', fontWeight: '600', marginBottom: '4px' }}>Catatan Penyelesaian</label>
                              <input type="text" value={proofNotes} onChange={(e) => setProofNotes(e.target.value)} placeholder="Area sudah dibersihkan" style={{ width: '100%', padding: '7px', borderRadius: '6px', border: '1px solid #cbd5e1' }} />
                            </div>
                          </div>
                          <div style={{ display: 'flex', gap: '8px' }}>
                            <button type="button" onClick={() => setCompletingTaskId(null)} style={{ padding: '7px 12px', borderRadius: '6px', border: '1px solid #cbd5e1', background: '#fff' }}>Batal</button>
                            <button type="submit" disabled={submittingProof} style={{ padding: '7px 14px', borderRadius: '6px', border: 'none', background: '#0f766e', color: '#fff', fontWeight: '600' }}>
                              {submittingProof ? 'Mengunggah...' : 'Kirim Bukti Selesai'}
                            </button>
                          </div>
                        </form>
                      ) : (
                        <button
                          onClick={() => setCompletingTaskId(t.id)}
                          style={{ padding: '7px 14px', borderRadius: '8px', border: 'none', background: '#0f766e', color: '#fff', fontWeight: '600', cursor: 'pointer', fontSize: '0.84rem' }}
                        >
                          Laporkan Pekerjaan Selesai
                        </button>
                      )}
                    </div>
                  )}
                </div>
              ))}
            </div>
          )}
        </div>
      )}

      {tab === 'komunitas' && (
        <CommunityHub
          currentUser={profile}
          hotspots={sortedHotspots}
          onSelectHotspotOnMap={onSelectHotspotOnMap}
          onToast={(text) => setMsg(text)}
        />
      )}

      {tab === 'profil' && (
        <div style={{ background: '#fff', padding: '20px', borderRadius: '12px', border: '1px solid #e2e8f0', maxWidth: '600px' }}>
          <h3 style={{ marginTop: 0 }}>Profil & Tingkat Level Sukarelawan</h3>
          <div style={{ display: 'grid', gap: '8px', fontSize: '0.9rem' }}>
            <div><strong>Nama Lengkap:</strong> {profile?.full_name}</div>
            <div><strong>Umur:</strong> {profile?.age} Tahun</div>
            <div><strong>Email:</strong> {profile?.email}</div>
            <div><strong>Nomor Telepon:</strong> {profile?.phone}</div>
            <div><strong>Riwayat Penyakit:</strong> {profile?.medical_history || 'Tidak ada'}</div>
            <div><strong>Jumlah Pekerjaan Selesai:</strong> {profile?.completed_tasks_count || 0} Lokasi</div>
            <div><strong>Total Poin Pengalaman:</strong> {profile?.experience_points || 0} XP</div>
            <div><strong>Level Saat Ini:</strong> <span style={{ color: '#0f766e', fontWeight: '700' }}>{profile?.volunteer_level || 'Pemula'}</span></div>
          </div>
        </div>
      )}
    </div>
  );
}