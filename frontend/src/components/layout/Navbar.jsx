import React from 'react';

export default function Navbar({ activePage, onNavigate, user }) {
  const isVolunteer = user?.role === 'volunteer';

  const navLinkStyle = (pageName) => ({
    padding: '9px 14px',
    borderRadius: '999px',
    border: '1px solid transparent',
    cursor: 'pointer',
    fontWeight: '600',
    fontSize: '0.88rem',
    transition: 'all 0.18s ease',
    background: activePage === pageName ? 'rgba(190, 242, 100, 0.13)' : 'transparent',
    color: activePage === pageName ? '#d9f99d' : '#d9e5df'
  });

  return (
    <header className="site-navbar">
      <div className="nav-inner">
        <button className="brand-lockup" onClick={() => onNavigate('map')} aria-label="Sirkula AI">
          <img className="brand-logo-image" src="/sirkula-logo.png" alt="Sirkula AI" />
        </button>

        <nav className="desktop-nav" aria-label="Navigasi utama">
          <button onClick={() => onNavigate('map')} style={navLinkStyle('map')}>Peta Hotspot</button>
          <button onClick={() => onNavigate('report')} style={navLinkStyle('report')}>Laporkan Sampah</button>
          <button onClick={() => onNavigate('volunteer')} style={navLinkStyle('volunteer')}>
            Sukarelawan
          </button>
        </nav>

        <button
          className="nav-cta"
          onClick={() => onNavigate(isVolunteer ? 'volunteer' : 'report')}
        >
          <span>{isVolunteer ? 'Dashboard Relawan' : 'Mulai Sekarang'}</span>
          <span className="cta-arrow">↗</span>
        </button>
      </div>
    </header>
  );
}
