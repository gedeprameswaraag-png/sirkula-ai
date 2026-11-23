import React, { useState } from 'react';

export default function VolunteerAuthPage({ onRegister, onLogin }) {
  const [mode, setMode] = useState('register'); // register | login
  const [loading, setLoading] = useState(false);
  const [error, setError] = useState('');

  // Form Register
  const [fullName, setFullName] = useState('');
  const [age, setAge] = useState('');
  const [email, setEmail] = useState('');
  const [phone, setPhone] = useState('');
  const [medicalHistory, setMedicalHistory] = useState('');
  const [password, setPassword] = useState('');
  const [healthDeclaration, setHealthDeclaration] = useState(false);

  // Form Login
  const [loginEmail, setLoginEmail] = useState('');
  const [loginPassword, setLoginPassword] = useState('');

  const handleRegister = async (e) => {
    e.preventDefault();
    setError('');

    if (!healthDeclaration) {
      setError('Anda wajib mencentang pernyataan bahwa Anda dalam kondisi sehat dan kuat.');
      return;
    }

    try {
      setLoading(true);
      await onRegister({
        full_name: fullName.trim(),
        age: Number(age),
        email: email.trim().toLowerCase(),
        phone: phone.trim(),
        medical_history: medicalHistory.trim() || 'Tidak ada riwayat penyakit',
        health_declaration: true,
        password
      });
    } catch (err) {
      setError(err.message || 'Gagal mendaftar sebagai sukarelawan.');
    } finally {
      setLoading(false);
    }
  };

  const handleLogin = async (e) => {
    e.preventDefault();
    setError('');
    try {
      setLoading(true);
      await onLogin(loginEmail.trim().toLowerCase(), loginPassword);
    } catch (err) {
      setError(err.message || 'Email atau kata sandi salah.');
    } finally {
      setLoading(false);
    }
  };

  return (
    <div style={{ maxWidth: '500px', margin: '28px auto', padding: '0 16px' }}>
      <div style={{ background: '#fff', borderRadius: '14px', border: '1px solid #e2e8f0', boxShadow: '0 6px 20px rgba(0,0,0,0.06)', overflow: 'hidden' }}>
        <div style={{ display: 'flex', borderBottom: '1px solid #e2e8f0' }}>
          <button
            type="button"
            onClick={() => { setMode('register'); setError(''); }}
            style={{
              flex: 1, padding: '14px', border: 'none', cursor: 'pointer', fontWeight: '700', fontSize: '0.92rem',
              background: mode === 'register' ? '#0f766e' : '#f8fafc',
              color: mode === 'register' ? '#fff' : '#475569'
            }}
          >
            Daftar Sukarelawan
          </button>
          <button
            type="button"
            onClick={() => { setMode('login'); setError(''); }}
            style={{
              flex: 1, padding: '14px', border: 'none', cursor: 'pointer', fontWeight: '700', fontSize: '0.92rem',
              background: mode === 'login' ? '#0f766e' : '#f8fafc',
              color: mode === 'login' ? '#fff' : '#475569'
            }}
          >
            Masuk Akun
          </button>
        </div>

        <div style={{ padding: '22px' }}>
          {error && (
            <div style={{ padding: '10px 12px', background: '#fef2f2', color: '#b91c1c', border: '1px solid #fecaca', borderRadius: '8px', fontSize: '0.85rem', marginBottom: '14px' }}>
              {error}
            </div>
          )}

          {mode === 'register' ? (
            <form onSubmit={handleRegister} style={{ display: 'grid', gap: '12px' }}>
              <div>
                <h3 style={{ margin: '0 0 4px 0', color: '#0f172a' }}>Formulir Pendaftaran Sukarelawan</h3>
                <p style={{ margin: 0, fontSize: '0.83rem', color: '#64748b' }}>
                  Lengkapi data diri Anda untuk bergabung membersihkan lingkungan bersama komunitas.
                </p>
              </div>

              <div>
                <label style={{ display: 'block', fontSize: '0.83rem', fontWeight: '600', marginBottom: '4px' }}>Nama Lengkap *</label>
                <input type="text" required value={fullName} onChange={(e) => setFullName(e.target.value)} placeholder="Nama lengkap sesuai identitas" style={{ width: '100%', padding: '9px 11px', borderRadius: '8px', border: '1px solid #cbd5e1' }} />
              </div>

              <div style={{ display: 'grid', gridTemplateColumns: '1fr 2fr', gap: '10px' }}>
                <div>
                  <label style={{ display: 'block', fontSize: '0.83rem', fontWeight: '600', marginBottom: '4px' }}>Umur (Tahun) *</label>
                  <input type="number" min="15" max="80" required value={age} onChange={(e) => setAge(e.target.value)} placeholder="21" style={{ width: '100%', padding: '9px 11px', borderRadius: '8px', border: '1px solid #cbd5e1' }} />
                </div>
                <div>
                  <label style={{ display: 'block', fontSize: '0.83rem', fontWeight: '600', marginBottom: '4px' }}>Nomor WhatsApp / HP *</label>
                  <input type="tel" required value={phone} onChange={(e) => setPhone(e.target.value)} placeholder="0812xxxxxxxx" style={{ width: '100%', padding: '9px 11px', borderRadius: '8px', border: '1px solid #cbd5e1' }} />
                </div>
              </div>

              <div>
                <label style={{ display: 'block', fontSize: '0.83rem', fontWeight: '600', marginBottom: '4px' }}>Email Aktif *</label>
                <input type="email" required value={email} onChange={(e) => setEmail(e.target.value)} placeholder="nama@email.com" style={{ width: '100%', padding: '9px 11px', borderRadius: '8px', border: '1px solid #cbd5e1' }} />
              </div>

              <div>
                <label style={{ display: 'block', fontSize: '0.83rem', fontWeight: '600', marginBottom: '4px' }}>Kata Sandi *</label>
                <input type="password" minLength="6" required value={password} onChange={(e) => setPassword(e.target.value)} placeholder="Minimal 6 karakter" style={{ width: '100%', padding: '9px 11px', borderRadius: '8px', border: '1px solid #cbd5e1' }} />
              </div>

              <div>
                <label style={{ display: 'block', fontSize: '0.83rem', fontWeight: '600', marginBottom: '4px' }}>Riwayat Penyakit</label>
                <textarea
                  rows="2"
                  value={medicalHistory}
                  onChange={(e) => setMedicalHistory(e.target.value)}
                  placeholder="Contoh: Tidak ada / Asma ringan / Alergi debu"
                  style={{ width: '100%', padding: '9px 11px', borderRadius: '8px', border: '1px solid #cbd5e1', fontFamily: 'inherit' }}
                />
              </div>

              <label style={{ display: 'flex', alignItems: 'flex-start', gap: '10px', padding: '12px', background: '#f0fdf4', border: '1px solid #bbf7d0', borderRadius: '8px', cursor: 'pointer', fontSize: '0.84rem', color: '#14532d' }}>
                <input
                  type="checkbox"
                  checked={healthDeclaration}
                  onChange={(e) => setHealthDeclaration(e.target.checked)}
                  style={{ marginTop: '3px', transform: 'scale(1.15)' }}
                />
                <span>
                  <strong>Pernyataan Sehat & Kuat:</strong> Saya menyatakan bahwa saya dalam kondisi fisik dan mental yang <b>sehat dan kuat</b> untuk menjadi sukarelawan pada proyek ini.
                </span>
              </label>

              <button
                type="submit"
                disabled={loading}
                style={{ marginTop: '4px', padding: '12px', background: '#0f766e', color: '#fff', border: 'none', borderRadius: '8px', fontWeight: '700', fontSize: '0.95rem', cursor: 'pointer' }}
              >
                {loading ? 'Mendaftarkan Akun...' : 'Buat Akun & Masuk Dashboard Sukarelawan'}
              </button>
            </form>
          ) : (
            <form onSubmit={handleLogin} style={{ display: 'grid', gap: '12px' }}>
              <h3 style={{ margin: '0 0 4px 0', color: '#0f172a' }}>Masuk Akun Sukarelawan</h3>
              <div>
                <label style={{ display: 'block', fontSize: '0.83rem', fontWeight: '600', marginBottom: '4px' }}>Email</label>
                <input type="email" required value={loginEmail} onChange={(e) => setLoginEmail(e.target.value)} placeholder="nama@email.com" style={{ width: '100%', padding: '9px 11px', borderRadius: '8px', border: '1px solid #cbd5e1' }} />
              </div>
              <div>
                <label style={{ display: 'block', fontSize: '0.83rem', fontWeight: '600', marginBottom: '4px' }}>Kata Sandi</label>
                <input type="password" required value={loginPassword} onChange={(e) => setLoginPassword(e.target.value)} placeholder="••••••" style={{ width: '100%', padding: '9px 11px', borderRadius: '8px', border: '1px solid #cbd5e1' }} />
              </div>
              <button
                type="submit"
                disabled={loading}
                style={{ marginTop: '4px', padding: '12px', background: '#0f766e', color: '#fff', border: 'none', borderRadius: '8px', fontWeight: '700', fontSize: '0.95rem', cursor: 'pointer' }}
              >
                {loading ? 'Memeriksa Akun...' : 'Masuk Sekarang'}
              </button>
            </form>
          )}
        </div>
      </div>
    </div>
  );
}