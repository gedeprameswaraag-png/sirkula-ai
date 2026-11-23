import React, { useEffect, useState } from 'react';

export default function VolunteerAuthPage({
  initialNotice,
  onClearNotice,
  onRegister,
  onResendEmail,
  onLogin
}) {
  // Mode tampilan ala Laravel Breeze: 'register' | 'verify-email' | 'login'
  const [view, setView] = useState('register');
  const [pendingEmail, setPendingEmail] = useState('');
  const [notice, setNotice] = useState(initialNotice || null);
  const [errorMsg, setErrorMsg] = useState('');
  const [submitting, setSubmitting] = useState(false);
  const [resendCooldown, setResendCooldown] = useState(0);

  // State form registrasi
  const [fullName, setFullName] = useState('');
  const [age, setAge] = useState('');
  const [phone, setPhone] = useState('');
  const [email, setEmail] = useState('');
  const [password, setPassword] = useState('');
  const [medicalHistory, setMedicalHistory] = useState('');
  const [healthDeclaration, setHealthDeclaration] = useState(false);

  // State form login
  const [loginEmail, setLoginEmail] = useState('');
  const [loginPassword, setLoginPassword] = useState('');

  // Sinkronkan notice dari callback link email Supabase
  useEffect(() => {
    if (!initialNotice) return;
    setNotice(initialNotice);
    if (initialNotice.type === 'success') {
      setView('login');
    } else if (initialNotice.type === 'error') {
      setView('verify-email');
    }
  }, [initialNotice]);

  // Hitung mundur tombol kirim ulang email
  useEffect(() => {
    if (resendCooldown <= 0) return;
    const timer = setInterval(() => {
      setResendCooldown((prev) => (prev > 0 ? prev - 1 : 0));
    }, 1000);
    return () => clearInterval(timer);
  }, [resendCooldown]);

  const handleRegisterSubmit = async (e) => {
    e.preventDefault();
    setErrorMsg('');
    setNotice(null);

    try {
      setSubmitting(true);
      const res = await onRegister({
        full_name: fullName,
        age: Number(age),
        phone,
        email,
        password,
        medical_history: medicalHistory || 'Tidak ada',
        health_declaration: healthDeclaration
      });

      const targetEmail = (res?.email || email).trim().toLowerCase();
      setPendingEmail(targetEmail);
      setLoginEmail(targetEmail);
      setResendCooldown(60);
      setView('verify-email'); // Langsung ganti halaman ke layar konfirmasi email ala Laravel Breeze
    } catch (err) {
      setErrorMsg(err.message || 'Gagal mendaftarkan akun sukarelawan.');
    } finally {
      setSubmitting(false);
    }
  };

  const handleResend = async (e) => {
    if (e) e.preventDefault();
    const target = (pendingEmail || loginEmail || email).trim().toLowerCase();
    if (!target) {
      setErrorMsg('Masukkan alamat email Anda untuk mengirim ulang tautan verifikasi.');
      return;
    }

    try {
      setSubmitting(true);
      setErrorMsg('');
      const res = await onResendEmail(target);
      setNotice({
        type: 'success',
        message: res?.message || `Tautan verifikasi baru telah dikirim ke ${target}.`
      });
      setResendCooldown(60);
    } catch (err) {
      setErrorMsg(err.message || 'Gagal mengirim ulang email verifikasi.');
    } finally {
      setSubmitting(false);
    }
  };

  const handleLoginSubmit = async (e) => {
    e.preventDefault();
    setErrorMsg('');
    try {
      setSubmitting(true);
      await onLogin(loginEmail, loginPassword);
    } catch (err) {
      const msg = err.message || 'Gagal masuk.';
      setErrorMsg(msg);
      // Jika gagal karena belum verifikasi email, tawarkan langsung pindah ke layar verify-email
      if (msg.toLowerCase().includes('belum diverifikasi')) {
        setPendingEmail(loginEmail.trim().toLowerCase());
      }
    } finally {
      setSubmitting(false);
    }
  };

  // =========================================================================
  // TAMPILAN 1: HALAMAN VERIFY-EMAIL (ALA LARAVEL BREEZE)
  // =========================================================================
  if (view === 'verify-email') {
    return (
      <div style={{ maxWidth: '480px', margin: '36px auto', padding: '0 16px' }}>
        <div style={{ background: '#fff', border: '1px solid #e2e8f0', borderRadius: '14px', padding: '28px', boxShadow: '0 10px 25px rgba(15,23,42,0.06)' }}>
          <div style={{ width: '48px', height: '48px', borderRadius: '12px', background: '#f0fdfa', color: '#0f766e', display: 'flex', alignItems: 'center', justifyContent: 'center', fontSize: '1.5rem', marginBottom: '16px' }}>
            ✉️
          </div>

          <h2 style={{ margin: '0 0 8px 0', fontSize: '1.3rem', color: '#0f172a' }}>
            Verifikasi Alamat Email Anda
          </h2>

          <p style={{ margin: '0 0 16px 0', fontSize: '0.9rem', lineHeight: '1.6', color: '#475569' }}>
            Terima kasih telah mendaftar sebagai Sukarelawan SirkulaAI! Sebelum melanjutkan, silakan verifikasi alamat email Anda dengan mengklik tautan yang baru saja kami kirimkan ke{' '}
            {pendingEmail ? <strong style={{ color: '#0f172a' }}>{pendingEmail}</strong> : 'email Anda'}.
          </p>

          {notice && (
            <div
              style={{
                padding: '10px 14px',
                borderRadius: '8px',
                marginBottom: '14px',
                fontSize: '0.85rem',
                fontWeight: '600',
                background: notice.type === 'error' ? '#fef2f2' : '#f0fdf4',
                border: `1px solid ${notice.type === 'error' ? '#fecaca' : '#bbf7d0'}`,
                color: notice.type === 'error' ? '#b91c1c' : '#15803d'
              }}
            >
              {notice.message}
            </div>
          )}

          {errorMsg && (
            <div style={{ padding: '10px 14px', borderRadius: '8px', marginBottom: '14px', fontSize: '0.85rem', background: '#fef2f2', border: '1px solid #fecaca', color: '#b91c1c' }}>
              {errorMsg}
            </div>
          )}

          {!pendingEmail && (
            <div style={{ marginBottom: '14px' }}>
              <label style={{ display: 'block', fontSize: '0.82rem', fontWeight: '600', color: '#334155', marginBottom: '4px' }}>
                Alamat Email Terdaftar
              </label>
              <input
                type="email"
                value={loginEmail}
                onChange={(e) => setLoginEmail(e.target.value)}
                placeholder="nama@email.com"
                style={{ width: '100%', padding: '9px 12px', borderRadius: '8px', border: '1px solid #cbd5e1', fontSize: '0.9rem', boxSizing: 'border-box' }}
              />
            </div>
          )}

          <div style={{ display: 'flex', flexDirection: 'column', gap: '10px', marginTop: '18px' }}>
            <button
              type="button"
              onClick={() => {
                setErrorMsg('');
                setView('login');
              }}
              style={{
                width: '100%',
                padding: '11px',
                borderRadius: '8px',
                border: 'none',
                background: '#0f766e',
                color: '#fff',
                fontWeight: '700',
                fontSize: '0.92rem',
                cursor: 'pointer'
              }}
            >
              Sudah Klik Tautan di Email? Masuk Sekarang →
            </button>

            <button
              type="button"
              disabled={submitting || resendCooldown > 0}
              onClick={handleResend}
              style={{
                width: '100%',
                padding: '10px',
                borderRadius: '8px',
                border: '1px solid #cbd5e1',
                background: '#f8fafc',
                color: resendCooldown > 0 ? '#94a3b8' : '#334155',
                fontWeight: '600',
                fontSize: '0.86rem',
                cursor: submitting || resendCooldown > 0 ? 'not-allowed' : 'pointer'
              }}
            >
              {submitting
                ? 'Mengirim ulang...'
                : resendCooldown > 0
                  ? `Kirim Ulang Email Verifikasi (${resendCooldown}d)`
                  : 'Kirim Ulang Email Verifikasi'}
            </button>
          </div>

          <div style={{ marginTop: '18px', paddingTop: '14px', borderTop: '1px solid #f1f5f9', display: 'flex', justifyContent: 'space-between', fontSize: '0.82rem' }}>
            <button
              type="button"
              onClick={() => {
                setErrorMsg('');
                setNotice(null);
                if (onClearNotice) onClearNotice();
                setView('register');
              }}
              style={{ background: 'none', border: 'none', color: '#64748b', cursor: 'pointer', textDecoration: 'underline', padding: 0 }}
            >
              ← Ganti Email / Daftar Ulang
            </button>
            <span style={{ color: '#94a3b8' }}>Cek juga folder Spam</span>
          </div>
        </div>
      </div>
    );
  }

  // =========================================================================
  // TAMPILAN 2 & 3: FORM DAFTAR & FORM LOGIN SUKARELAWAN
  // =========================================================================
  return (
    <div style={{ maxWidth: '480px', margin: '28px auto', padding: '0 16px' }}>
      <div style={{ background: '#fff', border: '1px solid #e2e8f0', borderRadius: '14px', padding: '24px', boxShadow: '0 8px 20px rgba(15,23,42,0.05)' }}>
        {/* Tab Switch Daftar / Masuk */}
        <div style={{ display: 'grid', gridTemplateColumns: '1fr 1fr', gap: '6px', background: '#f1f5f9', padding: '4px', borderRadius: '10px', marginBottom: '20px' }}>
          <button
            type="button"
            onClick={() => { setView('register'); setErrorMsg(''); }}
            style={{
              padding: '8px',
              borderRadius: '8px',
              border: 'none',
              fontWeight: '700',
              fontSize: '0.88rem',
              cursor: 'pointer',
              background: view === 'register' ? '#fff' : 'transparent',
              color: view === 'register' ? '#0f766e' : '#64748b',
              boxShadow: view === 'register' ? '0 1px 3px rgba(0,0,0,0.1)' : 'none'
            }}
          >
            Daftar Relawan Baru
          </button>
          <button
            type="button"
            onClick={() => { setView('login'); setErrorMsg(''); }}
            style={{
              padding: '8px',
              borderRadius: '8px',
              border: 'none',
              fontWeight: '700',
              fontSize: '0.88rem',
              cursor: 'pointer',
              background: view === 'login' ? '#fff' : 'transparent',
              color: view === 'login' ? '#0f766e' : '#64748b',
              boxShadow: view === 'login' ? '0 1px 3px rgba(0,0,0,0.1)' : 'none'
            }}
          >
            Masuk Akun Relawan
          </button>
        </div>

        {notice && (
          <div
            style={{
              padding: '10px 14px',
              borderRadius: '8px',
              marginBottom: '14px',
              fontSize: '0.85rem',
              fontWeight: '600',
              background: notice.type === 'error' ? '#fef2f2' : '#f0fdf4',
              border: `1px solid ${notice.type === 'error' ? '#fecaca' : '#bbf7d0'}`,
              color: notice.type === 'error' ? '#b91c1c' : '#15803d'
            }}
          >
            {notice.message}
          </div>
        )}

        {errorMsg && (
          <div style={{ padding: '10px 14px', borderRadius: '8px', marginBottom: '14px', fontSize: '0.85rem', background: '#fef2f2', border: '1px solid #fecaca', color: '#b91c1c' }}>
            {errorMsg}
            {errorMsg.toLowerCase().includes('belum diverifikasi') && (
              <div style={{ marginTop: '6px' }}>
                <button
                  type="button"
                  onClick={() => setView('verify-email')}
                  style={{ background: 'none', border: 'none', color: '#0f766e', fontWeight: '700', textDecoration: 'underline', cursor: 'pointer', padding: 0 }}
                >
                  Buka halaman kirim ulang verifikasi email →
                </button>
              </div>
            )}
          </div>
        )}

        {view === 'register' ? (
          <form onSubmit={handleRegisterSubmit} style={{ display: 'grid', gap: '12px' }}>
            <div>
              <h3 style={{ margin: '0 0 4px 0', color: '#0f172a' }}>Formulir Pendaftaran Sukarelawan</h3>
              <p style={{ margin: 0, fontSize: '0.84rem', color: '#64748b' }}>
                Gunakan email aktif untuk menerima tautan verifikasi akun.
              </p>
            </div>

            <div>
              <label style={{ display: 'block', fontSize: '0.82rem', fontWeight: '600', marginBottom: '4px' }}>Nama Lengkap *</label>
              <input type="text" required value={fullName} onChange={(e) => setFullName(e.target.value)} placeholder="Nama sesuai identitas" style={{ width: '100%', padding: '9px 11px', borderRadius: '8px', border: '1px solid #cbd5e1', boxSizing: 'border-box' }} />
            </div>

            <div style={{ display: 'grid', gridTemplateColumns: '1fr 1.6fr', gap: '10px' }}>
              <div>
                <label style={{ display: 'block', fontSize: '0.82rem', fontWeight: '600', marginBottom: '4px' }}>Umur (Tahun) *</label>
                <input type="number" min="15" max="80" required value={age} onChange={(e) => setAge(e.target.value)} placeholder="20" style={{ width: '100%', padding: '9px 11px', borderRadius: '8px', border: '1px solid #cbd5e1', boxSizing: 'border-box' }} />
              </div>
              <div>
                <label style={{ display: 'block', fontSize: '0.82rem', fontWeight: '600', marginBottom: '4px' }}>Nomor WhatsApp / HP *</label>
                <input type="tel" required value={phone} onChange={(e) => setPhone(e.target.value)} placeholder="081234567890" style={{ width: '100%', padding: '9px 11px', borderRadius: '8px', border: '1px solid #cbd5e1', boxSizing: 'border-box' }} />
              </div>
            </div>

            <div>
              <label style={{ display: 'block', fontSize: '0.82rem', fontWeight: '600', marginBottom: '4px' }}>Email Aktif *</label>
              <input type="email" required value={email} onChange={(e) => setEmail(e.target.value)} placeholder="nama@gmail.com" style={{ width: '100%', padding: '9px 11px', borderRadius: '8px', border: '1px solid #cbd5e1', boxSizing: 'border-box' }} />
            </div>

            <div>
              <label style={{ display: 'block', fontSize: '0.82rem', fontWeight: '600', marginBottom: '4px' }}>Kata Sandi *</label>
              <input type="password" minLength={6} required value={password} onChange={(e) => setPassword(e.target.value)} placeholder="Minimal 6 karakter" style={{ width: '100%', padding: '9px 11px', borderRadius: '8px', border: '1px solid #cbd5e1', boxSizing: 'border-box' }} />
            </div>

            <div>
              <label style={{ display: 'block', fontSize: '0.82rem', fontWeight: '600', marginBottom: '4px' }}>Riwayat Penyakit</label>
              <textarea rows={2} value={medicalHistory} onChange={(e) => setMedicalHistory(e.target.value)} placeholder="Contoh: Tidak ada / Asma ringan / Alergi debu" style={{ width: '100%', padding: '9px 11px', borderRadius: '8px', border: '1px solid #cbd5e1', boxSizing: 'border-box' }} />
            </div>

            <label style={{ display: 'flex', gap: '8px', alignItems: 'flex-start', background: '#f0fdf4', padding: '10px', borderRadius: '8px', border: '1px solid #bbf7d0', fontSize: '0.82rem', color: '#166534', cursor: 'pointer' }}>
              <input type="checkbox" required checked={healthDeclaration} onChange={(e) => setHealthDeclaration(e.target.checked)} style={{ marginTop: '3px' }} />
              <span>
                <strong>Pernyataan Sehat & Kuat:</strong> Saya menyatakan bahwa saya dalam kondisi fisik dan mental yang <strong>sehat dan kuat</strong> untuk melakukan kegiatan pembersihan lingkungan.
              </span>
            </label>

            <button
              type="submit"
              disabled={submitting}
              style={{
                width: '100%',
                padding: '11px',
                borderRadius: '8px',
                border: 'none',
                background: '#0f766e',
                color: '#fff',
                fontWeight: '700',
                fontSize: '0.95rem',
                cursor: submitting ? 'not-allowed' : 'pointer',
                marginTop: '4px'
              }}
            >
              {submitting ? 'Mendaftarkan & Mengirim Email Verifikasi...' : 'Daftar Jadi Sukarelawan'}
            </button>
          </form>
        ) : (
          <form onSubmit={handleLoginSubmit} style={{ display: 'grid', gap: '12px' }}>
            <div>
              <h3 style={{ margin: '0 0 4px 0', color: '#0f172a' }}>Masuk Akun Sukarelawan</h3>
              <p style={{ margin: 0, fontSize: '0.84rem', color: '#64748b' }}>
                Pastikan Anda sudah mengklik tautan verifikasi di email Anda.
              </p>
            </div>

            <div>
              <label style={{ display: 'block', fontSize: '0.82rem', fontWeight: '600', marginBottom: '4px' }}>Email</label>
              <input type="email" required value={loginEmail} onChange={(e) => setLoginEmail(e.target.value)} placeholder="nama@gmail.com" style={{ width: '100%', padding: '9px 11px', borderRadius: '8px', border: '1px solid #cbd5e1', boxSizing: 'border-box' }} />
            </div>

            <div>
              <label style={{ display: 'block', fontSize: '0.82rem', fontWeight: '600', marginBottom: '4px' }}>Kata Sandi</label>
              <input type="password" required value={loginPassword} onChange={(e) => setLoginPassword(e.target.value)} placeholder="Kata sandi akun" style={{ width: '100%', padding: '9px 11px', borderRadius: '8px', border: '1px solid #cbd5e1', boxSizing: 'border-box' }} />
            </div>

            <button
              type="submit"
              disabled={submitting}
              style={{
                width: '100%',
                padding: '11px',
                borderRadius: '8px',
                border: 'none',
                background: '#0f766e',
                color: '#fff',
                fontWeight: '700',
                fontSize: '0.95rem',
                cursor: submitting ? 'not-allowed' : 'pointer',
                marginTop: '4px'
              }}
            >
              {submitting ? 'Memeriksa Akun...' : 'Masuk Dashboard Sukarelawan'}
            </button>
          </form>
        )}
      </div>
    </div>
  );
}