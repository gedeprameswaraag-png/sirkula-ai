import React, { useEffect, useState } from 'react';

export default function Navbar({ activePage, onNavigate, user }) {
  const [menuOpen, setMenuOpen] = useState(false);
  const isVolunteer = user?.role === 'volunteer';

  useEffect(() => {
    const handleKeyDown = (event) => {
      if (event.key === 'Escape') setMenuOpen(false);
    };
    window.addEventListener('keydown', handleKeyDown);
    return () => window.removeEventListener('keydown', handleKeyDown);
  }, []);

  const navigate = (pageName) => {
    setMenuOpen(false);
    onNavigate(pageName);
  };

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
          <button onClick={() => navigate('map')} style={navLinkStyle('map')}>Peta Hotspot</button>
          <button onClick={() => navigate('report')} style={navLinkStyle('report')}>Laporkan Sampah</button>
          <button onClick={() => navigate('volunteer')} style={navLinkStyle('volunteer')}>
            Sukarelawan
          </button>
        </nav>

        <button
          className="nav-cta"
          onClick={() => navigate(isVolunteer ? 'volunteer' : 'report')}
        >
          <span>{isVolunteer ? 'Dashboard Relawan' : 'Mulai Sekarang'}</span>
          <span className="cta-arrow">↗</span>
        </button>

        <button
          className={`nav-menu-toggle${menuOpen ? ' is-open' : ''}`}
          type="button"
          aria-label={menuOpen ? 'Tutup menu navigasi' : 'Buka menu navigasi'}
          aria-controls="mobile-navigation"
          aria-expanded={menuOpen}
          onClick={() => setMenuOpen((open) => !open)}
        >
          <span />
          <span />
          <span />
        </button>

        <nav
          id="mobile-navigation"
          className={`mobile-nav${menuOpen ? ' is-open' : ''}`}
          aria-label="Navigasi utama"
        >
          <button onClick={() => navigate('map')} style={navLinkStyle('map')}>Peta Hotspot</button>
          <button onClick={() => navigate('report')} style={navLinkStyle('report')}>Laporkan Sampah</button>
          <button onClick={() => navigate('volunteer')} style={navLinkStyle('volunteer')}>
            Sukarelawan
          </button>
        </nav>
      </div>
    </header>
  );
}
