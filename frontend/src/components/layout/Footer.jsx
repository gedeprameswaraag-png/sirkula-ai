import React from 'react';

export default function Footer({ onOpenAdmin }) {
  return (
    <footer
      style={{
        background: '#ffffff',
        borderTop: '1px solid #e2e8f0',
        padding: '12px 20px',
        display: 'flex',
        justifyContent: 'space-between',
        alignItems: 'center',
        fontSize: '0.8rem',
        color: '#64748b'
      }}
    >
      <span>© 2026 SirkulaAI — Pemetaan & Aksi Kolaborasi Lingkungan</span>

      <button
        onClick={onOpenAdmin}
        style={{
          background: 'none',
          border: 'none',
          color: '#94a3b8',
          cursor: 'pointer',
          fontSize: '0.78rem',
          textDecoration: 'underline'
        }}
      >
        Portal Admin
      </button>
    </footer>
  );
}