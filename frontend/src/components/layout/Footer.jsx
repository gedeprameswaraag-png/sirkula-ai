import React from 'react';

export default function Footer({ onOpenAdmin }) {
  return (
    <footer className="site-footer">
      <div className="footer-landscape" aria-hidden="true">
        <span className="hill hill-1" />
        <span className="hill hill-2" />
        <span className="tree tree-1" />
        <span className="tree tree-2" />
        <span className="tree tree-3" />
      </div>

      <div className="footer-inner">
        <div className="footer-brand">
          <div className="brand-lockup footer-logo">
            <img className="brand-logo-image footer-logo-image" src="/sirkula-logo.png" alt="Sirkula AI" />
          </div>
          <p>Teknologi AI untuk kota yang lebih bersih, sehat, dan berkelanjutan.</p>
        </div>

        <div className="footer-col">
          <h4>Jelajahi</h4>
          <button onClick={() => onOpenAdmin?.()}>Portal Admin</button>
          <span>Peta Hotspot</span>
          <span>Laporkan Sampah</span>
          <span>Sukarelawan</span>
        </div>

        <div className="footer-col">
          <h4>Tentang</h4>
          <span>Misi & Dampak</span>
          <span>Teknologi AI</span>
          <span>Kolaborasi</span>
          <span>Kontak</span>
        </div>

        <div className="footer-col">
          <h4>Ikuti Kami</h4>
          <div className="social-row">
            <span>◎</span><span>▶</span><span>●</span><span>in</span>
          </div>
          <small>© 2026 Sirkula AI</small>
        </div>
      </div>
    </footer>
  );
}
