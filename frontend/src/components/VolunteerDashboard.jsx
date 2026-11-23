import React, { useEffect, useState } from 'react';
import { supabase } from '../supabaseClient';
import MapPage from './MapPage.jsx';

const API_BASE = import.meta.env.VITE_API_URL || '/api';

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

export default function VolunteerDashboard({ currentUser, onLogout }) {
  const [tab, setTab] = useState('peta'); // peta | riwayat | komunitas | profil
  const [profile, setProfile] = useState(currentUser);
  const [myGroups, setMyGroups] = useState([]);
  const [tasks, setTasks] = useState([]);
  const [hotspots, setHotspots] = useState([]);
  const [community, setCommunity] = useState({ volunteers: [], groups: [] });
  const [selectedGroupId, setSelectedGroupId] = useState('');
  const [searchVol, setSearchVol] = useState('');
  const [groupName, setGroupName] = useState('');
  const [groupDesc, setGroupDesc] = useState('');
  const [msg, setMsg] = useState('');

  // State form penyelesaian tugas
  const [completingTaskId, setCompletingTaskId] = useState(null);
  const [weightKg, setWeightKg] = useState('');
  const [proofNotes, setProofNotes] = useState('');
  const [proofFile, setProofFile] = useState(null);
  const [submittingProof, setSubmittingProof] = useState(false);

  const loadAll = async () => {
    try {
      const [dashRes, hsRes, commRes] = await Promise.all([
        volFetch('/volunteer/dashboard'),
        volFetch('/public/hotspots'),
        volFetch('/volunteer/community')
      ]);
      if (dashRes.profile) setProfile(dashRes.profile);
      setMyGroups(dashRes.my_groups || []);
      setTasks(dashRes.tasks || []);
      setHotspots((hsRes.hotspots || []).filter((h) => h.status === 'open'));
      setCommunity({ volunteers: commRes.volunteers || [], groups: commRes.groups || [] });
    } catch (err) {
      setMsg(err.message);
    }
  };

  useEffect(() => {
    loadAll();
  }, []);

  const handleClaim = async (hotspotId) => {
    try {
      await volFetch(`/volunteer/hotspots/${hotspotId}/claim`, {
        method: 'POST',
        body: JSON.stringify({ group_id: selectedGroupId || null })
      });
      setMsg('Tugas pembersihan berhasil diambil! Silakan buka tab Riwayat Penyelesaian.');
      loadAll();
    } catch (err) {
      setMsg(err.message);
    }
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

  const handleCreateGroup = async (e) => {
    e.preventDefault();
    try {
      await volFetch('/volunteer/groups', {
        method: 'POST',
        body: JSON.stringify({ name: groupName, description: groupDesc })
      });
      setGroupName('');
      setGroupDesc('');
      setMsg('Grup kolaborasi berhasil dibuat.');
      loadAll();
    } catch (err) {
      setMsg(err.message);
    }
  };

  const handleJoinGroup = async (groupId) => {
    try {
      await volFetch(`/volunteer/groups/${groupId}/join`, { method: 'POST' });
      setMsg('Berhasil bergabung ke grup kolaborasi.');
      loadAll();
    } catch (err) {
      setMsg(err.message);
    }
  };

  const isVerified = profile?.volunteer_status === 'verified';

  return (
    <div style={{ maxWidth: '1040px', margin: '0 auto', padding: '16px' }}>
      <div style={{ background: '#0f766e', color: '#fff', borderRadius: '12px', padding: '16px 20px', display: 'flex', justifyContent: 'space-between', alignItems: 'center', flexWrap: 'wrap', gap: '12px', marginBottom: '16px' }}>
        <div>
          <div style={{ fontSize: '0.8rem', opacity: 0.85 }}>Dashboard Sukarelawan</div>
          <h2 style={{ margin: '2px 0' }}>{profile?.full_name}</h2>
          <div style={{ display: 'flex', gap: '8px', marginTop: '4px', fontSize: '0.82rem' }}>
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
        <div style={{ padding: '10px 14px', background: '#f0fdfa', border: '1px solid #99f6e4', color: '#0f766e', borderRadius: '8px', marginBottom: '14px', fontSize: '0.88rem', fontWeight: '600' }}>
          {msg}
        </div>
      )}

      <div style={{ display: 'flex', gap: '8px', flexWrap: 'wrap', marginBottom: '16px' }}>
        {[
          { id: 'peta', label: '🗺️ Peta & Ambil Tugas' },
          { id: 'riwayat', label: `📋 Riwayat Penyelesaian (${tasks.length})` },
          { id: 'komunitas', label: '🤝 Komunitas & Grup' },
          { id: 'profil', label: '👤 Profil & Level' }
        ].map((t) => (
          <button
            key={t.id}
            onClick={() => setTab(t.id)}
            style={{
              padding: '9px 15px', borderRadius: '8px', border: 'none', cursor: 'pointer', fontWeight: '700', fontSize: '0.88rem',
              background: tab === t.id ? '#0f766e' : '#e2e8f0',
              color: tab === t.id ? '#fff' : '#334155'
            }}
          >
            {t.label}
          </button>
        ))}
      </div>

      {tab === 'peta' && (
        <div style={{ display: 'grid', gap: '18px' }}>
          <div style={{ background: '#fff', padding: '16px', borderRadius: '12px', border: '1px solid #e2e8f0' }}>
            <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center', flexWrap: 'wrap', gap: '10px', marginBottom: '12px' }}>
              <h3 style={{ margin: 0 }}>Titik Sampah Siap Dibersihkan ({hotspots.length})</h3>
              <select value={selectedGroupId} onChange={(e) => setSelectedGroupId(e.target.value)} style={{ padding: '6px 10px', borderRadius: '8px', border: '1px solid #cbd5e1' }}>
                <option value="">Kerjakan Sebagai Individu</option>
                {myGroups.map((g) => (
                  <option key={g.id} value={g.id}>Grup: {g.name}</option>
                ))}
              </select>
            </div>
            {hotspots.length === 0 ? (
              <p style={{ color: '#64748b', fontSize: '0.9rem' }}>Belum ada titik lokasi terbuka yang menunggu pembersihan.</p>
            ) : (
              <div style={{ display: 'grid', gridTemplateColumns: 'repeat(auto-fill, minmax(260px, 1fr))', gap: '12px' }}>
                {hotspots.map((hs) => (
                  <div key={hs.id} style={{ border: '1px solid #e2e8f0', borderRadius: '10px', padding: '12px', background: '#f8fafc' }}>
                    <div style={{ fontWeight: '700' }}>{hs.title}</div>
                    <div style={{ fontSize: '0.8rem', color: '#64748b', margin: '4px 0 10px 0' }}>Prioritas: {hs.priority_level?.toUpperCase()}</div>
                    <button
                      disabled={!isVerified}
                      onClick={() => handleClaim(hs.id)}
                      style={{ width: '100%', padding: '8px', borderRadius: '8px', border: 'none', background: isVerified ? '#0f766e' : '#cbd5e1', color: isVerified ? '#fff' : '#64748b', fontWeight: '700', cursor: isVerified ? 'pointer' : 'not-allowed' }}
                    >
                      {isVerified ? 'Ambil Tugas Ini' : 'Menunggu Verifikasi Admin'}
                    </button>
                  </div>
                ))}
              </div>
            )}
          </div>
          <MapPage />
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
        <div style={{ display: 'grid', gridTemplateColumns: 'repeat(auto-fit, minmax(300px, 1fr))', gap: '16px' }}>
          <div style={{ background: '#fff', padding: '16px', borderRadius: '12px', border: '1px solid #e2e8f0' }}>
            <h3 style={{ marginTop: 0 }}>Grup Kolaborasi</h3>
            <form onSubmit={handleCreateGroup} style={{ display: 'grid', gap: '8px', marginBottom: '14px' }}>
              <input type="text" required value={groupName} onChange={(e) => setGroupName(e.target.value)} placeholder="Nama Grup Kolaborasi Baru" style={{ padding: '8px', borderRadius: '6px', border: '1px solid #cbd5e1' }} />
              <input type="text" value={groupDesc} onChange={(e) => setGroupDesc(e.target.value)} placeholder="Deskripsi singkat grup" style={{ padding: '8px', borderRadius: '6px', border: '1px solid #cbd5e1' }} />
              <button type="submit" style={{ padding: '8px', borderRadius: '6px', border: 'none', background: '#0f766e', color: '#fff', fontWeight: '600', cursor: 'pointer' }}>Buat Grup</button>
            </form>
            {community.groups.map((g) => (
              <div key={g.id} style={{ padding: '10px', border: '1px solid #e2e8f0', borderRadius: '8px', marginBottom: '8px' }}>
                <div style={{ fontWeight: '700' }}>{g.name}</div>
                <p style={{ margin: '4px 0 8px 0', fontSize: '0.82rem', color: '#475569' }}>{g.description}</p>
                <button onClick={() => handleJoinGroup(g.id)} style={{ padding: '5px 10px', borderRadius: '6px', border: '1px solid #0f766e', background: '#fff', color: '#0f766e', fontSize: '0.8rem', cursor: 'pointer' }}>
                  Gabung Grup
                </button>
              </div>
            ))}
          </div>

          <div style={{ background: '#fff', padding: '16px', borderRadius: '12px', border: '1px solid #e2e8f0' }}>
            <h3 style={{ marginTop: 0 }}>Cari Sukarelawan Lain</h3>
            <input type="text" value={searchVol} onChange={(e) => setSearchVol(e.target.value)} placeholder="Cari nama relawan..." style={{ width: '100%', padding: '8px', borderRadius: '6px', border: '1px solid #cbd5e1', marginBottom: '10px' }} />
            {community.volunteers
              .filter((v) => v.full_name?.toLowerCase().includes(searchVol.toLowerCase()))
              .map((v) => (
                <div key={v.id} style={{ padding: '8px 10px', border: '1px solid #e2e8f0', borderRadius: '8px', marginBottom: '6px', display: 'flex', justifyContent: 'space-between' }}>
                  <span><b>{v.full_name}</b> ({v.completed_tasks_count || 0} tugas)</span>
                  <span style={{ color: '#0f766e', fontWeight: '700' }}>{v.volunteer_level || 'Pemula'}</span>
                </div>
              ))}
          </div>
        </div>
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