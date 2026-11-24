import React, { useCallback, useEffect, useRef, useState } from 'react';
import { supabase } from '../supabaseClient';
import { sessionApi } from '../api.js';
import '../dashboard.css';

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

/* ---------- Data & helper tampilan ---------- */

const SEVERITIES = {
  ringan: { label: 'Ringan', score: 30, hint: 'Sampah sedikit dan belum mengganggu.' },
  sedang: { label: 'Sedang', score: 55, hint: 'Sampah menumpuk dan perlu segera dibersihkan.' },
  parah: { label: 'Parah', score: 85, hint: 'Tumpukan besar atau berisiko bagi warga.' }
};

function normalizeSeverity(value) {
  const v = String(value || '').toLowerCase();
  if (['low', 'ringan'].includes(v)) return 'ringan';
  if (['high', 'critical', 'parah'].includes(v)) return 'parah';
  if (['medium', 'sedang'].includes(v)) return 'sedang';
  return null;
}

// Saran AI hanya dipakai jika AI yakin foto ini sampah nyata
function suggestedSeverity(report) {
  if (report.ai_is_valid_waste !== true) return 'sedang';
  return normalizeSeverity(report.ai_severity) || 'sedang';
}

function formatTime(value) {
  if (!value) return '-';
  return new Date(value).toLocaleString('id-ID', { day: 'numeric', month: 'short', year: 'numeric', hour: '2-digit', minute: '2-digit' });
}

function volunteerState(status) {
  if (status === 'verified') return { label: 'Terverifikasi', tone: 'ok' };
  if (status === 'rejected') return { label: 'Ditolak', tone: 'bad' };
  return { label: 'Menunggu verifikasi', tone: 'wait' };
}

function taskState(status) {
  if (status === 'submitted') return { label: 'Perlu diperiksa', tone: 'wait' };
  if (status === 'approved') return { label: 'Disahkan', tone: 'ok' };
  if (status === 'in_progress') return { label: 'Sedang dikerjakan', tone: '' };
  return { label: status || '-', tone: '' };
}

const ICONS = {
  inbox: (<><path d="M22 12h-6l-2 3h-4l-2-3H2" /><path d="M5.45 5.11 2 12v6a2 2 0 0 0 2 2h16a2 2 0 0 0 2-2v-6l-3.45-6.89A2 2 0 0 0 16.76 4H7.24a2 2 0 0 0-1.79 1.11z" /></>),
  check: (<><rect x="8" y="2" width="8" height="4" rx="1" /><path d="M16 4h2a2 2 0 0 1 2 2v14a2 2 0 0 1-2 2H6a2 2 0 0 1-2-2V6a2 2 0 0 1 2-2h2" /><path d="m9 14 2 2 4-4" /></>),
  users: (<><path d="M16 21v-2a4 4 0 0 0-4-4H6a4 4 0 0 0-4 4v2" /><circle cx="9" cy="7" r="4" /><path d="M22 21v-2a4 4 0 0 0-3-3.87" /><path d="M16 3.13a4 4 0 0 1 0 7.75" /></>),
  userPlus: (<><path d="M16 21v-2a4 4 0 0 0-4-4H6a4 4 0 0 0-4 4v2" /><circle cx="9" cy="7" r="4" /><path d="M19 8v6" /><path d="M22 11h-6" /></>),
  map: (<><path d="M20 10c0 6-8 12-8 12S4 16 4 10a8 8 0 0 1 16 0z" /><circle cx="12" cy="10" r="3" /></>),
  logout: (<><path d="M9 21H5a2 2 0 0 1-2-2V5a2 2 0 0 1 2-2h4" /><path d="m16 17 5-5-5-5" /><path d="M21 12H9" /></>),
  refresh: (<><path d="M3 12a9 9 0 0 1 15-6.7L21 8" /><path d="M21 3v5h-5" /><path d="M21 12a9 9 0 0 1-15 6.7L3 16" /><path d="M3 21v-5h5" /></>),
  close: (<><path d="M18 6 6 18" /><path d="m6 6 12 12" /></>),
  zoom: (<><path d="M15 3h6v6" /><path d="M9 21H3v-6" /><path d="m21 3-7 7" /><path d="m3 21 7-7" /></>),
  image: (<><rect x="3" y="3" width="18" height="18" rx="2" /><circle cx="9" cy="9" r="2" /><path d="m21 15-3.1-3.1a2 2 0 0 0-2.8 0L6 21" /></>)
};

function Icon({ name }) {
  return (
    <svg className="sk-icon" viewBox="0 0 24 24" aria-hidden="true">
      {ICONS[name]}
    </svg>
  );
}

function Lightbox({ src, onClose }) {
  useEffect(() => {
    const onKey = (e) => e.key === 'Escape' && onClose();
    window.addEventListener('keydown', onKey);
    return () => window.removeEventListener('keydown', onKey);
  }, [onClose]);

  return (
    <div className="sk-lightbox" role="dialog" aria-modal="true" aria-label="Foto diperbesar" onClick={onClose}>
      <button type="button" className="sk-lightbox__close" onClick={onClose} aria-label="Tutup foto" autoFocus>
        <Icon name="close" />
      </button>
      <img src={src} alt="Foto bukti diperbesar" onClick={(e) => e.stopPropagation()} />
      <a className="sk-lightbox__link" href={src} target="_blank" rel="noreferrer" onClick={(e) => e.stopPropagation()}>
        Buka foto di tab baru
      </a>
    </div>
  );
}

function Thumb({ url, onOpen, label }) {
  if (!url) {
    return (
      <div className="sk-thumb" aria-label="Tidak ada foto">
        <Icon name="image" />
      </div>
    );
  }
  return (
    <button type="button" className="sk-thumb" onClick={onOpen} aria-label={label || 'Perbesar foto'}>
      <img src={url} alt="" loading="lazy" />
    </button>
  );
}

/* ---------- Komponen utama ---------- */

export default function AdminPortal({ currentUser, onLoginAdmin, onLogoutAdmin, onBackToPublic }) {
  const [email, setEmail] = useState('');
  const [password, setPassword] = useState('');
  const [loading, setLoading] = useState(false);
  const [err, setErr] = useState('');
  const [notice, setNotice] = useState({ type: '', text: '' });
  const [tab, setTab] = useState('laporan'); // laporan | pekerjaan | relawan | tambah-admin

  const [reports, setReports] = useState([]);
  const [volunteers, setVolunteers] = useState([]);
  const [tasks, setTasks] = useState([]);
  const [loadingData, setLoadingData] = useState(false);

  const [reportFilter, setReportFilter] = useState('pending'); // pending | verified | rejected
  const [selectedId, setSelectedId] = useState(null);
  const [severities, setSeverities] = useState({});
  const [titles, setTitles] = useState({});
  const [busyId, setBusyId] = useState(null);
  const [lightbox, setLightbox] = useState('');
  const detailRef = useRef(null);

  const [newAdminName, setNewAdminName] = useState('');
  const [newAdminEmail, setNewAdminEmail] = useState('');
  const [newAdminPassword, setNewAdminPassword] = useState('');
  const [adminMsg, setAdminMsg] = useState({ type: '', text: '' });
  const [creatingAdmin, setCreatingAdmin] = useState(false);

  const isAdmin = currentUser && ['admin', 'super_admin'].includes(currentUser.role);

  const loadAdminData = useCallback(async () => {
    if (!isAdmin) return;
    setLoadingData(true);
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
    } finally {
      setLoadingData(false);
    }
  }, [isAdmin]);

  useEffect(() => {
    loadAdminData();
  }, [loadAdminData]);

  // Pemberitahuan sukses hilang sendiri; pesan galat tetap sampai ditutup
  useEffect(() => {
    if (notice.type !== 'ok') return undefined;
    const timer = setTimeout(() => setNotice({ type: '', text: '' }), 6000);
    return () => clearTimeout(timer);
  }, [notice]);

  const handleLogin = async (e) => {
    e.preventDefault();
    setErr('');
    try {
      setLoading(true);
      const { user } = await sessionApi.login(email, password);
      if (!user || !['admin', 'super_admin'].includes(user.role)) {
        await sessionApi.logout();
        setErr('Akun ini tidak memiliki hak akses Admin.');
        return;
      }
      onLoginAdmin(user);
    } catch (e2) {
      setErr(e2.message);
    } finally {
      setLoading(false);
    }
  };

  const handleVerifyReport = async (report, approved) => {
    if (!approved && !window.confirm('Tolak laporan ini? Laporan tidak akan tampil di peta.')) return;
    setNotice({ type: '', text: '' });
    setBusyId(report.id);
    try {
      const sev = severities[report.id] || suggestedSeverity(report);
      const title = titles[report.id]?.trim() || `Titik Sampah (${SEVERITIES[sev].label})`;
      const res = await adminFetch(`/admin/reports/${report.id}/verify`, {
        method: 'PATCH',
        body: JSON.stringify({ approved, title, severity_level: sev })
      });
      setNotice({ type: 'ok', text: res.message || (approved ? 'Laporan diterbitkan ke peta.' : 'Laporan ditolak.') });
      setSelectedId(null);
      await loadAdminData();
    } catch (e) {
      setNotice({ type: 'err', text: `Gagal memproses laporan: ${e.message}` });
    } finally {
      setBusyId(null);
    }
  };

  const handleVerifyVolunteer = async (volId, status) => {
    setNotice({ type: '', text: '' });
    setBusyId(volId);
    try {
      await adminFetch(`/admin/volunteers/${volId}/verify`, { method: 'PATCH', body: JSON.stringify({ status }) });
      setNotice({ type: 'ok', text: status === 'verified' ? 'Akun relawan terverifikasi.' : 'Akun relawan ditolak.' });
      await loadAdminData();
    } catch (e) {
      setNotice({ type: 'err', text: e.message });
    } finally {
      setBusyId(null);
    }
  };

  const handleReviewTask = async (taskId, approved) => {
    let reviewNotes;
    if (!approved) {
      const note = window.prompt('Catatan untuk relawan, misalnya foto kurang jelas:', '');
      if (note === null) return;
      reviewNotes = note.trim() || undefined;
    }
    setNotice({ type: '', text: '' });
    setBusyId(taskId);
    try {
      const res = await adminFetch(`/admin/tasks/${taskId}/approve`, {
        method: 'PATCH',
        body: JSON.stringify({ approved, review_notes: reviewNotes })
      });
      setNotice({ type: 'ok', text: res.message || (approved ? 'Pekerjaan disahkan.' : 'Pekerjaan dikembalikan ke relawan.') });
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
        body: JSON.stringify({ full_name: newAdminName, email: newAdminEmail, password: newAdminPassword })
      });
      setAdminMsg({ type: 'ok', text: res.message });
      setNewAdminName('');
      setNewAdminEmail('');
      setNewAdminPassword('');
    } catch (e2) {
      setAdminMsg({ type: 'err', text: e2.message });
    } finally {
      setCreatingAdmin(false);
    }
  };

  /* ---------- Belum login sebagai admin ---------- */
  if (!isAdmin) {
    return (
      <div className="sk-root sk-login">
        <div className="sk-login__box">
          <div>
            <h1>Masuk sebagai admin</h1>
            <p className="sk-hint">Halaman ini untuk koordinator dan verifikator SirkulaAI.</p>
          </div>
          {err && <div className="sk-notice sk-notice--err" role="alert">{err}</div>}
          <form onSubmit={handleLogin} style={{ display: 'grid', gap: 14 }}>
            <div className="sk-field">
              <label htmlFor="admin-email">Email</label>
              <input id="admin-email" className="sk-input" type="email" required autoComplete="username" value={email} onChange={(e) => setEmail(e.target.value)} />
            </div>
            <div className="sk-field">
              <label htmlFor="admin-pass">Kata sandi</label>
              <input id="admin-pass" className="sk-input" type="password" required autoComplete="current-password" value={password} onChange={(e) => setPassword(e.target.value)} />
            </div>
            <button type="submit" disabled={loading} className="sk-btn sk-btn--primary sk-btn--block">
              {loading ? 'Memeriksa akun...' : 'Masuk'}
            </button>
            <button type="button" onClick={onBackToPublic} className="sk-btn sk-btn--ghost sk-btn--block">
              Kembali ke peta publik
            </button>
          </form>
        </div>
      </div>
    );
  }

  /* ---------- Turunan data ---------- */
  const pending = reports.filter((r) => !['verified', 'rejected'].includes(r.status));
  const verified = reports.filter((r) => r.status === 'verified');
  const rejected = reports.filter((r) => r.status === 'rejected');
  const filteredReports = reportFilter === 'pending' ? pending : reportFilter === 'verified' ? verified : rejected;
  const selected = filteredReports.find((r) => r.id === selectedId) || filteredReports[0] || null;

  const tasksToReview = tasks.filter((t) => t.status === 'submitted').length;
  const sortedTasks = [...tasks].sort((a, b) => {
    const rank = { submitted: 0, in_progress: 1, approved: 2 };
    return (rank[a.status] ?? 3) - (rank[b.status] ?? 3);
  });
  const volunteersToReview = volunteers.filter((v) => !['verified', 'rejected'].includes(v.volunteer_status)).length;

  const NAV = [
    { id: 'laporan', label: 'Laporan warga', icon: 'inbox', count: pending.length },
    { id: 'pekerjaan', label: 'Pekerjaan relawan', icon: 'check', count: tasksToReview },
    { id: 'relawan', label: 'Relawan', icon: 'users', count: volunteersToReview },
    { id: 'tambah-admin', label: 'Tambah admin', icon: 'userPlus', count: 0 }
  ];

  const HEAD = {
    laporan: ['Laporan warga', 'Periksa foto dan lokasi, tentukan tingkat dampak, lalu terbitkan ke peta.'],
    pekerjaan: ['Pekerjaan relawan', 'Periksa foto bukti sebelum pekerjaan disahkan dan XP diberikan.'],
    relawan: ['Relawan', 'Verifikasi akun baru dan hubungi relawan lewat WhatsApp.'],
    'tambah-admin': ['Tambah admin', 'Buat akun koordinator baru.']
  }[tab];

  const selectReport = (id) => {
    setSelectedId(id);
    if (window.innerWidth <= 880) {
      setTimeout(() => detailRef.current?.scrollIntoView({ behavior: 'smooth', block: 'start' }), 50);
    }
  };

  /* ---------- Tampilan ---------- */
  return (
    <div className="sk-root sk-admin">
      <aside className="sk-rail">
        <div className="sk-rail__brand">
          <h1>SirkulaAI</h1>
          <span>Meja verifikasi admin</span>
        </div>

        <nav className="sk-nav" aria-label="Menu admin">
          {NAV.map((item) => (
            <button key={item.id} type="button" aria-current={tab === item.id ? 'page' : undefined} onClick={() => setTab(item.id)}>
              <Icon name={item.icon} />
              {item.label}
              {item.count > 0 && <span className="sk-nav__count">{item.count}</span>}
            </button>
          ))}
        </nav>

        <div className="sk-rail__foot">
          <div className="sk-rail__who">Masuk sebagai {currentUser.email}</div>
          <button type="button" className="sk-btn sk-btn--sm" onClick={onBackToPublic}>
            <Icon name="map" /> Peta publik
          </button>
          <button type="button" className="sk-btn sk-btn--sm" onClick={onLogoutAdmin}>
            <Icon name="logout" /> Keluar
          </button>
        </div>
      </aside>

      <main className="sk-main">
        <div className="sk-main__head">
          <div>
            <h2>{HEAD[0]}</h2>
            <p>{HEAD[1]}</p>
          </div>
          <button type="button" className="sk-btn sk-btn--ghost sk-btn--sm" onClick={loadAdminData} disabled={loadingData}>
            <Icon name="refresh" /> {loadingData ? 'Memuat...' : 'Muat ulang'}
          </button>
        </div>

        {notice.text && (
          <div className={`sk-notice sk-notice--${notice.type === 'ok' ? 'ok' : 'err'}`} role={notice.type === 'ok' ? 'status' : 'alert'}>
            <span>{notice.text}</span>
            <button type="button" onClick={() => setNotice({ type: '', text: '' })} aria-label="Tutup pesan"><Icon name="close" /></button>
          </div>
        )}

        {/* ===== LAPORAN WARGA ===== */}
        {tab === 'laporan' && (
          <>
            <div className="sk-seg" role="group" aria-label="Filter laporan">
              <button type="button" aria-pressed={reportFilter === 'pending'} onClick={() => setReportFilter('pending')}>Menunggu ({pending.length})</button>
              <button type="button" aria-pressed={reportFilter === 'verified'} onClick={() => setReportFilter('verified')}>Terbit ({verified.length})</button>
              <button type="button" aria-pressed={reportFilter === 'rejected'} onClick={() => setReportFilter('rejected')}>Ditolak ({rejected.length})</button>
            </div>

            {filteredReports.length === 0 ? (
              <div className="sk-empty">
                <strong>{reportFilter === 'pending' ? 'Tidak ada laporan yang menunggu' : 'Belum ada laporan di daftar ini'}</strong>
                <span>{reportFilter === 'pending' ? 'Laporan baru muncul di sini setelah warga mengirim foto dari halaman lapor.' : 'Laporan yang sudah diproses akan tercatat di sini.'}</span>
              </div>
            ) : (
              <div className="sk-queue">
                <div className="sk-list" role="list">
                  {filteredReports.map((r) => {
                    const sev = reportFilter === 'verified' ? normalizeSeverity(r.severity_level) : r.ai_is_valid_waste === true ? normalizeSeverity(r.ai_severity) : null;
                    return (
                      <button
                        key={r.id}
                        type="button"
                        role="listitem"
                        className={`sk-item ${sev ? `sk-item--${sev}` : ''}`}
                        aria-pressed={selected?.id === r.id}
                        onClick={() => selectReport(r.id)}
                      >
                        <span className="sk-thumb">
                          {r.photo_url ? <img src={r.photo_url} alt="" loading="lazy" /> : <Icon name="image" />}
                        </span>
                        <span className="sk-item__body">
                          <span className="sk-item__title">{r.description || 'Tanpa catatan dari pelapor'}</span>
                          <span className="sk-item__meta">
                            {formatTime(r.created_at)}
                            {r.ai_is_valid_waste === true && <span className="sk-chip sk-chip--ok">AI: sampah</span>}
                            {r.ai_is_valid_waste === false && <span className="sk-chip sk-chip--bad">AI: tidak valid</span>}
                            {r.ai_is_valid_waste == null && <span className="sk-chip sk-chip--wait">AI ragu</span>}
                          </span>
                        </span>
                      </button>
                    );
                  })}
                </div>

                {selected && (
                  <article className="sk-detail" ref={detailRef}>
                    {selected.photo_url ? (
                      <button type="button" className="sk-photo" onClick={() => setLightbox(selected.photo_url)} aria-label="Perbesar foto laporan">
                        <img src={selected.photo_url} alt="Foto laporan dari warga" />
                        <span className="sk-photo__badge"><Icon name="zoom" /> Perbesar</span>
                      </button>
                    ) : (
                      <div className="sk-photo sk-photo--empty">
                        <Icon name="image" />
                        <strong>Foto tidak dapat dimuat</strong>
                        <span>Muat ulang halaman. Jika tetap kosong, periksa bucket report-photos di Supabase.</span>
                      </div>
                    )}

                    <div className="sk-detail__body">
                      <dl className="sk-facts">
                        <div><dt>Waktu laporan</dt><dd>{formatTime(selected.created_at)}</dd></div>
                        <div>
                          <dt>Koordinat</dt>
                          <dd>
                            {Number(selected.latitude).toFixed(5)}, {Number(selected.longitude).toFixed(5)}{' '}
                            <a href={`https://www.google.com/maps?q=${selected.latitude},${selected.longitude}`} target="_blank" rel="noreferrer">Buka di Maps</a>
                          </dd>
                        </div>
                        <div><dt>Pelapor</dt><dd>{selected.reporter_id ? 'Pengguna terdaftar' : 'Tamu tanpa akun'}</dd></div>
                        <div><dt>Catatan pelapor</dt><dd>{selected.description || 'Tidak ada catatan.'}</dd></div>
                      </dl>

                      <div className={`sk-ai ${selected.ai_is_valid_waste === true ? 'sk-ai--yes' : selected.ai_is_valid_waste === false ? 'sk-ai--no' : 'sk-ai--unsure'}`}>
                        <strong>
                          {selected.ai_is_valid_waste === true && 'AI menilai foto ini menunjukkan sampah nyata'}
                          {selected.ai_is_valid_waste === false && 'AI menilai foto ini bukan laporan sampah yang valid'}
                          {selected.ai_is_valid_waste == null && 'AI belum bisa memastikan, periksa foto secara manual'}
                        </strong>
                        {selected.ai_summary && <p>{selected.ai_summary}</p>}
                        {selected.ai_is_valid_waste === true && normalizeSeverity(selected.ai_severity) && (
                          <p>Saran AI untuk tingkat dampak: {SEVERITIES[normalizeSeverity(selected.ai_severity)].label}.</p>
                        )}
                      </div>

                      {reportFilter === 'pending' ? (
                        <>
                          <div className="sk-field">
                            <label htmlFor="titik-nama">Nama titik di peta (opsional)</label>
                            <input
                              id="titik-nama"
                              className="sk-input"
                              type="text"
                              maxLength={100}
                              value={titles[selected.id] || ''}
                              onChange={(e) => setTitles({ ...titles, [selected.id]: e.target.value })}
                              placeholder="Contoh: Tumpukan sampah di tepi Sungai Tuntang"
                            />
                          </div>

                          <div className="sk-field">
                            <label id="sev-label">Tingkat dampak</label>
                            <div className="sk-sevgroup" role="radiogroup" aria-labelledby="sev-label">
                              {Object.entries(SEVERITIES).map(([key, info]) => {
                                const current = severities[selected.id] || suggestedSeverity(selected);
                                return (
                                  <button
                                    key={key}
                                    type="button"
                                    role="radio"
                                    aria-checked={current === key}
                                    className={`sk-sev sk-sev--${key}`}
                                    onClick={() => setSeverities({ ...severities, [selected.id]: key })}
                                  >
                                    <strong>{info.label} <span>skor {info.score}</span></strong>
                                    <span>{info.hint}</span>
                                  </button>
                                );
                              })}
                            </div>
                          </div>

                          <div className="sk-actions">
                            <button type="button" className="sk-btn sk-btn--danger" disabled={busyId === selected.id} onClick={() => handleVerifyReport(selected, false)}>
                              Tolak laporan
                            </button>
                            <button type="button" className="sk-btn sk-btn--primary" disabled={busyId === selected.id} onClick={() => handleVerifyReport(selected, true)}>
                              {busyId === selected.id ? 'Menyimpan...' : 'Terbitkan ke peta'}
                            </button>
                          </div>
                        </>
                      ) : (
                        <div className={`sk-notice ${reportFilter === 'verified' ? 'sk-notice--ok' : 'sk-notice--err'}`}>
                          {reportFilter === 'verified'
                            ? `Laporan ini sudah terbit di peta dengan dampak ${SEVERITIES[normalizeSeverity(selected.severity_level) || 'sedang'].label.toLowerCase()}.`
                            : 'Laporan ini ditolak dan tidak tampil di peta.'}
                        </div>
                      )}
                    </div>
                  </article>
                )}
              </div>
            )}
          </>
        )}

        {/* ===== PEKERJAAN RELAWAN ===== */}
        {tab === 'pekerjaan' && (
          <div className="sk-rows">
            {sortedTasks.length === 0 ? (
              <div className="sk-empty">
                <strong>Belum ada pekerjaan dari relawan</strong>
                <span>Pekerjaan muncul di sini setelah relawan mengambil titik di peta.</span>
              </div>
            ) : (
              sortedTasks.map((t) => {
                const state = taskState(t.status);
                return (
                  <div key={t.id} className="sk-row">
                    <Thumb url={t.proof_photo_url} onOpen={() => setLightbox(t.proof_photo_url)} label="Perbesar foto bukti" />
                    <div className="sk-row__text">
                      <div className="sk-row__title">{t.hotspots?.title || 'Titik tanpa nama'}</div>
                      <div className="sk-row__sub">
                        Relawan {t.profiles?.full_name || '-'}
                        {t.actual_weight_kg ? `, sampah terkumpul ${t.actual_weight_kg} kg` : ''}
                      </div>
                      {t.completion_notes && <div className="sk-row__sub">Catatan: {t.completion_notes}</div>}
                      {t.status === 'in_progress' && t.admin_review_notes && <div className="sk-row__sub">Dikembalikan: {t.admin_review_notes}</div>}
                      <div><span className={`sk-chip ${state.tone ? `sk-chip--${state.tone}` : ''}`}>{state.label}</span></div>
                    </div>
                    <div className="sk-row__btns">
                      {t.status === 'submitted' && (
                        <>
                          <button type="button" className="sk-btn sk-btn--ghost sk-btn--sm" disabled={busyId === t.id} onClick={() => handleReviewTask(t.id, false)}>
                            Minta foto ulang
                          </button>
                          <button type="button" className="sk-btn sk-btn--primary sk-btn--sm" disabled={busyId === t.id} onClick={() => handleReviewTask(t.id, true)}>
                            {busyId === t.id ? 'Memproses...' : 'Sahkan selesai'}
                          </button>
                        </>
                      )}
                    </div>
                  </div>
                );
              })
            )}
          </div>
        )}

        {/* ===== RELAWAN ===== */}
        {tab === 'relawan' && (
          <div className="sk-rows">
            {volunteers.length === 0 ? (
              <div className="sk-empty">
                <strong>Belum ada relawan terdaftar</strong>
                <span>Akun yang mendaftar lewat halaman relawan akan muncul di sini.</span>
              </div>
            ) : (
              volunteers.map((v) => {
                const state = volunteerState(v.volunteer_status);
                return (
                  <div key={v.id} className="sk-row sk-row--plain">
                    <span className="sk-avatar" aria-hidden="true">{(v.full_name || '?').trim().charAt(0).toUpperCase()}</span>
                    <div className="sk-row__text">
                      <div className="sk-row__title">{v.full_name}</div>
                      <div className="sk-row__sub">
                        {v.age ? `${v.age} tahun, ` : ''}telepon {v.phone || '-'}, level {v.volunteer_level || 'Pemula'} ({v.experience_points || 0} XP)
                      </div>
                      {v.medical_history && v.medical_history !== 'Tidak ada' && (
                        <div className="sk-row__sub">Catatan kesehatan: {v.medical_history}</div>
                      )}
                      <div><span className={`sk-chip sk-chip--${state.tone}`}>{state.label}</span></div>
                    </div>
                    <div className="sk-row__btns">
                      {v.whatsapp_url && (
                        <a className="sk-btn sk-btn--ghost sk-btn--sm" href={v.whatsapp_url} target="_blank" rel="noreferrer">Hubungi lewat WhatsApp</a>
                      )}
                      {v.volunteer_status !== 'verified' && (
                        <button type="button" className="sk-btn sk-btn--primary sk-btn--sm" disabled={busyId === v.id} onClick={() => handleVerifyVolunteer(v.id, 'verified')}>
                          {busyId === v.id ? 'Memproses...' : 'Verifikasi akun'}
                        </button>
                      )}
                      {v.volunteer_status !== 'verified' && v.volunteer_status !== 'rejected' && (
                        <button type="button" className="sk-btn sk-btn--danger sk-btn--sm" disabled={busyId === v.id} onClick={() => handleVerifyVolunteer(v.id, 'rejected')}>
                          Tolak
                        </button>
                      )}
                    </div>
                  </div>
                );
              })
            )}
          </div>
        )}

        {/* ===== TAMBAH ADMIN ===== */}
        {tab === 'tambah-admin' && (
          <form className="sk-panel" onSubmit={handleCreateAdmin}>
            {adminMsg.text && (
              <div className={`sk-notice ${adminMsg.type === 'ok' ? 'sk-notice--ok' : 'sk-notice--err'}`} role="status">{adminMsg.text}</div>
            )}
            <div className="sk-field">
              <label htmlFor="new-admin-name">Nama lengkap</label>
              <input id="new-admin-name" className="sk-input" type="text" required value={newAdminName} onChange={(e) => setNewAdminName(e.target.value)} placeholder="Contoh: Koordinator Lapangan 2" />
            </div>
            <div className="sk-field">
              <label htmlFor="new-admin-email">Email</label>
              <input id="new-admin-email" className="sk-input" type="email" required value={newAdminEmail} onChange={(e) => setNewAdminEmail(e.target.value)} placeholder="koordinator2@sirkula.id" />
            </div>
            <div className="sk-field">
              <label htmlFor="new-admin-pass">Kata sandi</label>
              <input id="new-admin-pass" className="sk-input" type="password" minLength={6} required value={newAdminPassword} onChange={(e) => setNewAdminPassword(e.target.value)} />
              <span className="sk-hint">Minimal 6 karakter.</span>
            </div>
            <button type="submit" className="sk-btn sk-btn--primary" disabled={creatingAdmin}>
              {creatingAdmin ? 'Menyimpan akun...' : 'Buat akun admin'}
            </button>
          </form>
        )}
      </main>

      {lightbox && <Lightbox src={lightbox} onClose={() => setLightbox('')} />}
    </div>
  );
}
