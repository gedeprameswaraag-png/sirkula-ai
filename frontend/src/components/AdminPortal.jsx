import React, { useEffect, useState } from 'react';
import { supabase } from '../supabaseClient';
import { sessionApi } from '../api.js';

const API_BASE = import.meta.env.VITE_API_URL || '/api';

async function adminFetch(endpoint, options = {}) {
  const { data: { session } } = await supabase.auth.getSession();
  const headers = {
    'Content-Type': 'application/json',
    ...(session?.access_token ? { Authorization: `Bearer ${session.access_token}` } : {})
  };
  const res = await fetch(`${API_BASE}${endpoint}`, { ...options, headers });
  const contentType = res.headers.get('content-type') || '';
  if (!contentType.includes('application/json')) {
    throw new Error(`Server mengembalikan respons non-JSON (Status ${res.status}). Pastikan backend menyala.`);
  }
  const data = await res.json();
  if (!res.ok) throw new Error(data.message || 'Gagal memproses permintaan Admin.');
  return data;
}

export default function AdminPortal({ currentUser, onLoginAdmin, onLogoutAdmin, onBackToPublic }) {
  const [email, setEmail] = useState('');
  const [password, setPassword] = useState('');
  const [loading, setLoading] = useState(false);
  const [err, setErr] = useState('');
  const [notice, setNotice] = useState({ type: '', text: '' });
  const [tab, setTab] = useState('laporan'); // laporan | relawan | pekerjaan | tambah-admin

  const [reports, setReports] = useState([]);
  const [volunteers, setVolunteers] = useState([]);
  const [tasks, setTasks] = useState([]);
  const [severities, setSeverities] = useState({});
  const [titles, setTitles] = useState({});
  const [busyId, setBusyId] = useState(null);

  // State form Tambah Admin Baru
  const [newAdminName, setNewAdminName] = useState('');
  const [newAdminEmail, setNewAdminEmail] = useState('');
  const [newAdminPassword, setNewAdminPassword] = useState('');
  const [adminMsg, setAdminMsg] = useState({ type: '', text: '' });
  const [creatingAdmin, setCreatingAdmin] = useState(false);

  const isAdmin = currentUser && ['admin', 'super_admin'].includes(currentUser.role);

  const loadAdminData = async () => {
    if (!isAdmin) return;
    try {
      const [repRes, volRes, taskRes] = await Promise.all([
        adminFetch('/admin/reports'),
        adminFetch('/admin/volunteers'),
        adminFetch('/admin/tasks')
      ]);
      setReports(repRes.reports || []);
      setVolunteers(volRes.volunteers || []);
      setTasks(taskRes.tasks || []);
    } catch (e) {
      setNotice({ type: 'err', text: e.message });
    }
  };

  useEffect(() => {
    loadAdminData();
  }, [isAdmin]);

  const handleLogin = async (e) => {
    e.preventDefault();
    setErr('');
    try {
      setLoading(true);
      const { user } = await sessionApi.login(email, password);
      if (!['admin', 'super_admin'].includes(user.role)) {
        await sessionApi.logout();
        setErr('Akun ini tidak memiliki hak akses Admin.');
        return;
      }
      onLoginAdmin(user);
    } catch (e) {
      setErr(e.message);
    } finally {
      setLoading(false);
    }
  };

  const handleVerifyReport = async (reportId, approved) => {
    setNotice({ type: '', text: '' });
    setBusyId(reportId);
    try {
      const sev = severities[reportId] || 'sedang';
      const customTitle = titles[reportId]?.trim() || `Titik Sampah (${sev.toUpperCase()})`;

      const res = await adminFetch(`/admin/reports/${reportId}/verify`, {
        method: 'PATCH',
        body: JSON.stringify({
          approved,
          title: customTitle,
          severity_level: sev
        })
      });

      setNotice({ type: 'ok', text: res.message || (approved ? 'Laporan berhasil diterbitkan ke peta!' : 'Laporan ditolak.') });
      await loadAdminData();
    } catch (e) {
      setNotice({ type: 'err', text: `Gagal konfirmasi laporan: ${e.message}` });
    } finally {
      setBusyId(null);
    }
  };

  const handleVerifyVolunteer = async (volId, status) => {
    setNotice({ type: '', text: '' });
    setBusyId(volId);
    try {
      await adminFetch(`/admin/volunteers/${volId}/verify`, {
        method: 'PATCH',
        body: JSON.stringify({ status })
      });
      setNotice({ type: 'ok', text: status === 'verified' ? 'Akun sukarelawan berhasil diverifikasi.' : 'Akun sukarelawan ditolak.' });
      await loadAdminData();
    } catch (e) {
      setNotice({ type: 'err', text: e.message });
    } finally {
      setBusyId(null);
    }
  };

  const handleApproveTask = async (taskId) => {
    setNotice({ type: '', text: '' });
    setBusyId(taskId);
    try {
      const res = await adminFetch(`/admin/tasks/${taskId}/approve`, {
        method: 'PATCH',
        body: JSON.stringify({ approved: true })
      });
      setNotice({ type: 'ok', text: res.message || 'Pekerjaan relawan disahkan selesai.' });
      await loadAdminData();
    } catch (e) {
      setNotice({ type: 'err', text: e.message });
    } finally {
      setBusyId(null);
    }
  };

  const handleCreateAdmin = async (e) => {
    e.preventDefault();
    setAdminMsg({ type: '', text: '' });
    try {
      setCreatingAdmin(true);
      const res = await adminFetch('/admin/create-admin', {
        method: 'POST',
        body: JSON.stringify({
          full_name: newAdminName,
          email: newAdminEmail,
          password: newAdminPassword
        })
      });
      setAdminMsg({ type: 'ok', text: res.message });
      setNewAdminName('');
      setNewAdminEmail('');
      setNewAdminPassword('');
    } catch (e) {
      setAdminMsg({ type: 'err', text: e.message });
    } finally {
      setCreatingAdmin(false);
    }
  };

  if (!isAdmin) {
    return (
      <div style={{ minHeight: '100vh', background: '#0f172a', display: 'flex', alignItems: 'center', justifyContent: 'center', padding: '16px' }}>
        <div style={{ width: '100%', maxWidth: '400px', padding: '24px', background: '#1e293b', color: '#fff', borderRadius: '14px', border: '1px solid #334155' }}>
          <h2 style={{ marginTop: 0, fontSize: '1.25rem' }}>🔒 Pintu Masuk Khusus Admin</h2>
          <p style={{ fontSize: '0.84rem', color: '#94a3b8' }}>Halaman khusus koordinator & verifikator SirkulaAI.</p>
          {err && <div style={{ color: '#fca5a5', background: 'rgba(220,38,38,0.15)', padding: '8px 10px', borderRadius: '6px', fontSize: '0.84rem', marginBottom: '12px' }}>{err}</div>}
          <form onSubmit={handleLogin} style={{ display: 'grid', gap: '12px' }}>
            <input type="email" required value={email} onChange={(e) => setEmail(e.target.value)} placeholder="Email Admin" style={{ padding: '10px', borderRadius: '8px', border: '1px solid #475569', background: '#0f172a', color: '#fff' }} />
            <input type="password" required value={password} onChange={(e) => setPassword(e.target.value)} placeholder="Kata Sandi Admin" style={{ padding: '10px', borderRadius: '8px', border: '1px solid #475569', background: '#0f172a', color: '#fff' }} />
            <button type="submit" disabled={loading} style={{ padding: '10px', borderRadius: '8px', border: 'none', background: '#0f766e', color: '#fff', fontWeight: '700', cursor: 'pointer' }}>
              {loading ? 'Memverifikasi...' : 'Masuk Portal Admin'}
            </button>
            <button type="button" onClick={onBackToPublic} style={{ padding: '8px', borderRadius: '8px', border: '1px solid #475569', background: 'transparent', color: '#94a3b8', cursor: 'pointer' }}>
              Kembali ke Halaman Publik
            </button>
          </form>
        </div>
      </div>
    );
  }

  const pendingReports = reports.filter((r) => r.status !== 'verified' && r.status !== 'rejected');
  const verifiedReports = reports.filter((r) => r.status === 'verified');

  return (
    <div style={{ minHeight: '100vh', background: '#f1f5f9', padding: '20px 16px' }}>
      <div style={{ maxWidth: '1060px', margin: '0 auto' }}>
        <div style={{ background: '#0f172a', color: '#fff', padding: '16px 20px', borderRadius: '12px', display: 'flex', justifyContent: 'space-between', alignItems: 'center', flexWrap: 'wrap', gap: '10px', marginBottom: '16px' }}>
          <div>
            <h2 style={{ margin: 0, fontSize: '1.15rem' }}>🛡️ Dashboard Admin SirkulaAI</h2>
            <div style={{ fontSize: '0.8rem', color: '#94a3b8', marginTop: '2px' }}>Login aktif sebagai: {currentUser.email}</div>
          </div>
          <div style={{ display: 'flex', gap: '8px' }}>
            <button onClick={onBackToPublic} style={{ padding: '8px 14px', borderRadius: '8px', border: '1px solid #475569', background: '#1e293b', color: '#fff', cursor: 'pointer', fontSize: '0.85rem' }}>
              Lihat Peta Publik
            </button>
            <button onClick={onLogoutAdmin} style={{ padding: '8px 14px', borderRadius: '8px', border: 'none', background: '#dc2626', color: '#fff', cursor: 'pointer', fontSize: '0.85rem', fontWeight: '600' }}>
              Logout Admin
            </button>
          </div>
        </div>

        {notice.text && (
          <div
            style={{
              padding: '12px 16px',
              borderRadius: '10px',
              marginBottom: '16px',
              fontSize: '0.9rem',
              fontWeight: '600',
              background: notice.type === 'ok' ? '#dcfce7' : '#fee2e2',
              color: notice.type === 'ok' ? '#15803d' : '#b91c1c',
              border: `1px solid ${notice.type === 'ok' ? '#86efac' : '#fca5a5'}`
            }}
          >
            {notice.text}
          </div>
        )}

        {/* Menu Tab Admin */}
        <div style={{ display: 'flex', gap: '8px', flexWrap: 'wrap', marginBottom: '16px' }}>
          <button onClick={() => setTab('laporan')} style={{ padding: '9px 14px', borderRadius: '8px', border: 'none', fontWeight: '700', cursor: 'pointer', background: tab === 'laporan' ? '#0f766e' : '#e2e8f0', color: tab === 'laporan' ? '#fff' : '#1e293b' }}>
            Verifikasi Laporan ({pendingReports.length} Baru)
          </button>
          <button onClick={() => setTab('relawan')} style={{ padding: '9px 14px', borderRadius: '8px', border: 'none', fontWeight: '700', cursor: 'pointer', background: tab === 'relawan' ? '#0f766e' : '#e2e8f0', color: tab === 'relawan' ? '#fff' : '#1e293b' }}>
            Verifikasi & Kontak Relawan ({volunteers.length})
          </button>
          <button onClick={() => setTab('pekerjaan')} style={{ padding: '9px 14px', borderRadius: '8px', border: 'none', fontWeight: '700', cursor: 'pointer', background: tab === 'pekerjaan' ? '#0f766e' : '#e2e8f0', color: tab === 'pekerjaan' ? '#fff' : '#1e293b' }}>
            Verifikasi Pekerjaan Relawan ({tasks.length})
          </button>
          <button onClick={() => setTab('tambah-admin')} style={{ padding: '9px 14px', borderRadius: '8px', border: 'none', fontWeight: '700', cursor: 'pointer', background: tab === 'tambah-admin' ? '#0f172a' : '#e2e8f0', color: tab === 'tambah-admin' ? '#fff' : '#1e293b' }}>
            + Tambah Admin
          </button>
        </div>

        {/* TAB 1: VERIFIKASI LAPORAN */}
        {tab === 'laporan' && (
          <div style={{ display: 'grid', gap: '20px' }}>
            <div>
              <h3 style={{ margin: '0 0 10px 0', color: '#0f172a' }}>Menunggu Konfirmasi Admin ({pendingReports.length})</h3>
              {pendingReports.length === 0 ? (
                <div style={{ background: '#fff', padding: '18px', borderRadius: '10px', border: '1px solid #cbd5e1', color: '#64748b' }}>
                  Semua laporan baru sudah dikonfirmasi.
                </div>
              ) : (
                <div style={{ display: 'grid', gridTemplateColumns: 'repeat(auto-fill, minmax(300px, 1fr))', gap: '12px' }}>
                  {pendingReports.map((r) => {
                    const sev = severities[r.id] || r.severity_level || 'sedang';
                    const isBusy = busyId === r.id;
                    return (
                      <div key={r.id} style={{ background: '#fff', border: '1px solid #cbd5e1', borderRadius: '10px', padding: '14px' }}>
                        {r.photo_url && <img src={r.photo_url} alt="Laporan" style={{ width: '100%', height: '160px', objectFit: 'cover', borderRadius: '6px', marginBottom: '8px' }} />}
                        <div style={{ fontSize: '0.8rem', color: '#64748b' }}>
                          GPS: {Number(r.latitude).toFixed(5)}, {Number(r.longitude).toFixed(5)}
                        </div>
                        <p style={{ fontSize: '0.86rem', margin: '6px 0 10px 0', color: '#1e293b' }}>{r.description || 'Tanpa catatan tambahan.'}</p>

                        <input
                          type="text"
                          value={titles[r.id] || ''}
                          onChange={(e) => setTitles({ ...titles, [r.id]: e.target.value })}
                          placeholder="Nama Titik Lokasi (opsional)"
                          style={{ width: '100%', padding: '7px 9px', borderRadius: '6px', border: '1px solid #cbd5e1', marginBottom: '8px', fontSize: '0.84rem' }}
                        />

                        <select
                          value={sev}
                          onChange={(e) => setSeverities({ ...severities, [r.id]: e.target.value })}
                          style={{ width: '100%', padding: '7px', borderRadius: '6px', border: '1px solid #cbd5e1', marginBottom: '10px', fontSize: '0.85rem' }}
                        >
                          <option value="ringan">Dampak Ringan (Skor 30)</option>
                          <option value="sedang">Dampak Sedang (Skor 55)</option>
                          <option value="parah">Dampak Parah (Skor 85)</option>
                        </select>

                        <div style={{ display: 'flex', gap: '8px' }}>
                          <button
                            type="button"
                            disabled={isBusy}
                            onClick={() => handleVerifyReport(r.id, false)}
                            style={{ flex: 1, padding: '8px', background: '#fff', color: '#dc2626', border: '1px solid #dc2626', borderRadius: '6px', fontWeight: '600', cursor: 'pointer' }}
                          >
                            Tolak
                          </button>
                          <button
                            type="button"
                            disabled={isBusy}
                            onClick={() => handleVerifyReport(r.id, true)}
                            style={{ flex: 2, padding: '8px', background: '#0f766e', color: '#fff', border: 'none', borderRadius: '6px', fontWeight: '600', cursor: 'pointer' }}
                          >
                            {isBusy ? 'Menyimpan...' : 'Konfirmasi & Terbitkan'}
                          </button>
                        </div>
                      </div>
                    );
                  })}
                </div>
              )}
            </div>

            {verifiedReports.length > 0 && (
              <div>
                <h4 style={{ margin: '0 0 8px 0', color: '#475569' }}>Riwayat Laporan Terverifikasi ({verifiedReports.length})</h4>
                <div style={{ display: 'grid', gridTemplateColumns: 'repeat(auto-fill, minmax(260px, 1fr))', gap: '10px' }}>
                  {verifiedReports.map((r) => (
                    <div key={r.id} style={{ background: '#f8fafc', border: '1px solid #e2e8f0', borderRadius: '8px', padding: '10px', fontSize: '0.82rem' }}>
                      <div style={{ fontWeight: '700', color: '#15803d' }}>✓ Terbit di Peta ({r.severity_level?.toUpperCase()})</div>
                      <div style={{ color: '#475569', marginTop: '2px' }}>{r.description}</div>
                    </div>
                  ))}
                </div>
              </div>
            )}
          </div>
        )}

        {/* TAB 2: VERIFIKASI RELAWAN */}
        {tab === 'relawan' && (
          <div style={{ display: 'grid', gap: '10px' }}>
            {volunteers.map((v) => (
              <div key={v.id} style={{ background: '#fff', padding: '14px', borderRadius: '10px', border: '1px solid #cbd5e1', display: 'flex', justifyContent: 'space-between', alignItems: 'center', flexWrap: 'wrap', gap: '10px' }}>
                <div style={{ fontSize: '0.88rem' }}>
                  <strong>{v.full_name}</strong> ({v.age} th) · Status: <b>{v.volunteer_status}</b>
                  <div>Telp: {v.phone} · Riwayat Penyakit: <b>{v.medical_history}</b></div>
                </div>
                <div style={{ display: 'flex', gap: '8px' }}>
                  {v.whatsapp_url && (
                    <a href={v.whatsapp_url} target="_blank" rel="noreferrer" style={{ padding: '7px 12px', background: '#16a34a', color: '#fff', borderRadius: '6px', textDecoration: 'none', fontSize: '0.84rem', fontWeight: '600' }}>
                      Hubungi Relawan
                    </a>
                  )}
                  {v.volunteer_status !== 'verified' && (
                    <button
                      disabled={busyId === v.id}
                      onClick={() => handleVerifyVolunteer(v.id, 'verified')}
                      style={{ padding: '7px 12px', background: '#0f766e', color: '#fff', border: 'none', borderRadius: '6px', fontSize: '0.84rem', fontWeight: '600', cursor: 'pointer' }}
                    >
                      {busyId === v.id ? 'Memproses...' : 'Verifikasi Akun'}
                    </button>
                  )}
                </div>
              </div>
            ))}
          </div>
        )}

        {/* TAB 3: VERIFIKASI PEKERJAAN RELAWAN */}
        {tab === 'pekerjaan' && (
          <div style={{ display: 'grid', gap: '10px' }}>
            {tasks.length === 0 ? (
              <div style={{ background: '#fff', padding: '18px', borderRadius: '10px', border: '1px solid #cbd5e1', color: '#64748b' }}>
                Belum ada laporan pekerjaan dari sukarelawan.
              </div>
            ) : (
              tasks.map((t) => (
                <div key={t.id} style={{ background: '#fff', padding: '14px', borderRadius: '10px', border: '1px solid #cbd5e1', display: 'flex', justifyContent: 'space-between', alignItems: 'center' }}>
                  <div style={{ fontSize: '0.88rem' }}>
                    <strong>{t.hotspots?.title}</strong> — Oleh: {t.profiles?.full_name} ({t.status})
                  </div>
                  {t.status === 'submitted' && (
                    <button
                      disabled={busyId === t.id}
                      onClick={() => handleApproveTask(t.id)}
                      style={{ padding: '8px 12px', background: '#16a34a', color: '#fff', border: 'none', borderRadius: '6px', fontWeight: '600', cursor: 'pointer' }}
                    >
                      {busyId === t.id ? 'Mengesahkan...' : 'Sahkan Pekerjaan Selesai'}
                    </button>
                  )}
                </div>
              ))
            )}
          </div>
        )}

        {/* TAB 4: TAMBAH ADMIN BARU */}
        {tab === 'tambah-admin' && (
          <div style={{ background: '#fff', padding: '22px', borderRadius: '12px', border: '1px solid #cbd5e1', maxWidth: '480px' }}>
            <h3 style={{ marginTop: 0, color: '#0f172a' }}>Daftarkan Akun Admin Baru</h3>
            <p style={{ fontSize: '0.85rem', color: '#64748b', marginBottom: '16px' }}>
              Formulir ini hanya dapat diakses oleh Admin yang sedang login untuk menambahkan koordinator baru.
            </p>

            {adminMsg.text && (
              <div
                style={{
                  padding: '10px 12px',
                  borderRadius: '8px',
                  marginBottom: '14px',
                  fontSize: '0.85rem',
                  background: adminMsg.type === 'ok' ? '#f0fdf4' : '#fef2f2',
                  color: adminMsg.type === 'ok' ? '#15803d' : '#b91c1c',
                  border: `1px solid ${adminMsg.type === 'ok' ? '#bbf7d0' : '#fecaca'}`
                }}
              >
                {adminMsg.text}
              </div>
            )}

            <form onSubmit={handleCreateAdmin} style={{ display: 'grid', gap: '12px' }}>
              <div>
                <label style={{ display: 'block', fontSize: '0.83rem', fontWeight: '600', marginBottom: '4px' }}>Nama Lengkap Admin *</label>
                <input
                  type="text"
                  required
                  value={newAdminName}
                  onChange={(e) => setNewAdminName(e.target.value)}
                  placeholder="Contoh: Koordinator Lapangan 2"
                  style={{ width: '100%', padding: '9px 11px', borderRadius: '8px', border: '1px solid #cbd5e1' }}
                />
              </div>
              <div>
                <label style={{ display: 'block', fontSize: '0.83rem', fontWeight: '600', marginBottom: '4px' }}>Email Admin *</label>
                <input
                  type="email"
                  required
                  value={newAdminEmail}
                  onChange={(e) => setNewAdminEmail(e.target.value)}
                  placeholder="koordinator2@sirkula.id"
                  style={{ width: '100%', padding: '9px 11px', borderRadius: '8px', border: '1px solid #cbd5e1' }}
                />
              </div>
              <div>
                <label style={{ display: 'block', fontSize: '0.83rem', fontWeight: '600', marginBottom: '4px' }}>Kata Sandi *</label>
                <input
                  type="password"
                  minLength="6"
                  required
                  value={newAdminPassword}
                  onChange={(e) => setNewAdminPassword(e.target.value)}
                  placeholder="Minimal 6 karakter"
                  style={{ width: '100%', padding: '9px 11px', borderRadius: '8px', border: '1px solid #cbd5e1' }}
                />
              </div>
              <button
                type="submit"
                disabled={creatingAdmin}
                style={{ marginTop: '4px', padding: '11px', background: '#0f172a', color: '#fff', border: 'none', borderRadius: '8px', fontWeight: '700', cursor: 'pointer' }}
              >
                {creatingAdmin ? 'Menyimpan Akun Admin...' : '+ Buat Akun Admin Baru'}
              </button>
            </form>
          </div>
        )}
      </div>
    </div>
  );
}