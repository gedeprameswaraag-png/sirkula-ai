// E:\PROJEK\sirkula-ai\frontend\src\components\AuthBar.jsx
import React, { useState } from 'react';
import { authApi } from '../api';

const DEMO_ACCOUNTS = [
  { label: 'Login Warga', email: 'warga@sirkula.id', password: 'Password123!' },
  { label: 'Login Admin', email: 'admin@sirkula.id', password: 'Password123!' },
  { label: 'Login Relawan', email: 'relawan@sirkula.id', password: 'Password123!' }
];

export default function AuthBar({ currentUser, onAuthChange }) {
  const [loading, setLoading] = useState(false);

  const handleQuickLogin = async (acc) => {
    try {
      setLoading(true);
      const { user } = await authApi.login(acc.email, acc.password);
      onAuthChange(user);
    } catch (err) {
      alert(`Gagal login: ${err.message}`);
    } finally {
      setLoading(false);
    }
  };

  const handleLogout = async () => {
    await authApi.logout();
    onAuthChange(null);
  };

  return (
    <div style={{ padding: '10px 16px', background: '#1e293b', color: '#fff', display: 'flex', justifyContent: 'space-between', alignItems: 'center', flexWrap: 'wrap', gap: '8px' }}>
      <div>
        <strong>SirkulaAI</strong>{' '}
        <span style={{ fontSize: '0.85rem', opacity: 0.85 }}>
          | Peran Aktif: <b>{currentUser ? `${currentUser.full_name} (${currentUser.role.toUpperCase()})` : 'GUEST (Publik)'}</b>
        </span>
      </div>

      <div style={{ display: 'flex', gap: '6px', flexWrap: 'wrap' }}>
        {!currentUser ? (
          DEMO_ACCOUNTS.map((acc) => (
            <button
              key={acc.email}
              disabled={loading}
              onClick={() => handleQuickLogin(acc)}
              style={{ padding: '4px 10px', borderRadius: '4px', border: 'none', background: '#10b981', color: '#fff', cursor: 'pointer', fontSize: '0.8rem' }}
            >
              {loading ? '...' : acc.label}
            </button>
          ))
        ) : (
          <button
            onClick={handleLogout}
            style={{ padding: '4px 10px', borderRadius: '4px', border: 'none', background: '#ef4444', color: '#fff', cursor: 'pointer', fontSize: '0.8rem' }}
          >
            Keluar (Mode Guest)
          </button>
        )}
      </div>
    </div>
  );
}