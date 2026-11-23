import React from 'react';

export default function Navbar({ activePage, onNavigate, user }) {
  const isVolunteer = user?.role === 'volunteer';

  const navLinkStyle = (pageName) => ({
    padding: '8px 14px',
    borderRadius: '8px',
    border: 'none',
    cursor: 'pointer',
    fontWeight: '600',
    fontSize: '0.9rem',
    transition: 'all 0.15s ease',
    background: activePage === pageName ? '#f0fdfa' : 'transparent',
    color: activePage === pageName ? '#0f766e' : '#475569'
  });

  return (
    <header
      style={{
        background: '#ffffff',
        borderBottom: '1px solid #e2e8f0',
        padding: '0 20px',
        height: '64px',
        display: 'flex',
        alignItems: 'center',
        justifyContent: 'space-between',
        position: 'sticky',
        top: 0,
        zIndex: 1100
      }}
    >
      {/* Kiri: Brand Logo & Navigasi Publik */}
      <div style={{ display: 'flex', alignItems: 'center', gap: '20px' }}>
        <span
          onClick={() => onNavigate('map')}
          style={{
            fontWeight: '800',
            fontSize: '1.25rem',
            color: '#0f766e',
            cursor: 'pointer',
            letterSpacing: '-0.5px'
          }}
        >
          Sirkula<span style={{ color: '#0f172a' }}>AI</span>
        </span>

        <nav style={{ display: 'flex', gap: '6px' }}>
          <button onClick={() => onNavigate('map')} style={navLinkStyle('map')}>
            Peta Hotspot
          </button>
          <button onClick={() => onNavigate('report')} style={navLinkStyle('report')}>
            Laporkan Sampah
          </button>
        </nav>
      </div>

      {/* Paling Kanan: Tombol Sukarelawan */}
      <div>
        <button
          onClick={() => onNavigate('volunteer')}
          style={{
            padding: '9px 18px',
            borderRadius: '99px',
            border: 'none',
            background: isVolunteer ? '#0f172a' : '#0f766e',
            color: '#ffffff',
            fontWeight: '700',
            fontSize: '0.88rem',
            cursor: 'pointer',
            boxShadow: '0 2px 8px rgba(15, 118, 110, 0.22)'
          }}
        >
          {isVolunteer
            ? `Dashboard Relawan (${user.full_name?.split(' ')[0] || 'Aktif'})`
            : 'Mau Jadi Sukarelawan'}
        </button>
      </div>
    </header>
  );
}