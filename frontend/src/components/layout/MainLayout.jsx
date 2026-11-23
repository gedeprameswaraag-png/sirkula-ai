import React from 'react';
import Navbar from './Navbar.jsx';
import Footer from './Footer.jsx';

export default function MainLayout({ activePage, onNavigate, user, onOpenAdmin, children }) {
  return (
    <div
      style={{
        minHeight: '100vh',
        display: 'flex',
        flexDirection: 'column',
        background: '#f8fafc'
      }}
    >
      <Navbar activePage={activePage} onNavigate={onNavigate} user={user} />

      <main style={{ flex: 1 }}>
        {children}
      </main>

      <Footer onOpenAdmin={onOpenAdmin} />
    </div>
  );
}