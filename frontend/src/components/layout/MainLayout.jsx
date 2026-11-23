import React from 'react';
import Navbar from './Navbar.jsx';
import Footer from './Footer.jsx';

export default function MainLayout({ activePage, onNavigate, user, onOpenAdmin, children }) {
  return (
    <div className="site-shell">
      <Navbar activePage={activePage} onNavigate={onNavigate} user={user} />
      <main className="site-main">{children}</main>
      <Footer onOpenAdmin={onOpenAdmin} />
    </div>
  );
}
