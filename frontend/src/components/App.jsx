// Contoh kerangka integrasi di E:\PROJEK\sirkula-ai\frontend\src\App.jsx
import React, { useEffect, useState } from 'react';
import { authApi } from './api';
import AuthBar from './components/AuthBar';
import AdminDashboard from './components/AdminDashboard';
import VolunteerDashboard from './components/VolunteerDashboard';
// Impor komponen Peta dan Form Kamera Anda yang sudah ada:
// import MapTab from './components/MapTab';
// import ReportTab from './components/ReportTab';

export default function App() {
  const [currentUser, setCurrentUser] = useState(null);
  const [activeTab, setActiveTab] = useState('map');

  useEffect(() => {
    authApi.getCurrentUser().then((user) => {
      if (user) setCurrentUser(user);
    });
  }, []);

  const handleAuthChange = (user) => {
    setCurrentUser(user);
    // Arahkan otomatis ke tab sesuai role saat juri klik tombol demo
    if (!user) setActiveTab('map');
    else if (user.role === 'admin' || user.role === 'super_admin') setActiveTab('admin');
    else if (user.role === 'volunteer') setActiveTab('volunteer');
    else setActiveTab('report');
  };

  return (
    <div>
      <AuthBar currentUser={currentUser} onAuthChange={handleAuthChange} />

      {/* Navigasi Tab Sesuai Hak Akses Role */}
      <nav style={{ display: 'flex', gap: '8px', padding: '10px 16px', background: '#f8fafc', borderBottom: '1px solid #e2e8f0' }}>
        <button onClick={() => setActiveTab('map')}>Peta Hotspot (Publik)</button>

        {currentUser && (
          <button onClick={() => setActiveTab('report')}>Laporkan Sampah (Kamera)</button>
        )}

        {(currentUser?.role === 'admin' || currentUser?.role === 'super_admin') && (
          <button onClick={() => setActiveTab('admin')}>Dashboard Admin</button>
        )}

        {(currentUser?.role === 'volunteer' || currentUser?.role === 'admin') && (
          <button onClick={() => setActiveTab('volunteer')}>Tugas Sukarelawan</button>
        )}
      </nav>

      {/* Konten Utama */}
      <main>
        {activeTab === 'map' && (
          <div style={{ padding: '16px' }}>
            {/* Ganti dengan <MapTab /> milik Anda yang mengambil data dari publicApi.getHotspots() */}
            <p>Komponen Peta Hotspot (menggunakan data dari <code>publicApi.getHotspots()</code>).</p>
          </div>
        )}

        {activeTab === 'report' && (
          <div style={{ padding: '16px' }}>
            {/* Ganti dengan <ReportTab /> milik Anda yang mengirim data ke reportApi.createReport() */}
            <p>Komponen Kamera & GPS Pelapor (mengirim ke <code>reportApi.createReport()</code>).</p>
          </div>
        )}

        {activeTab === 'admin' && <AdminDashboard />}
        {activeTab === 'volunteer' && <VolunteerDashboard />}
      </main>
    </div>
  );
}