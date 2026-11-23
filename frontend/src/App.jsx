import React, { useEffect, useState } from 'react';
import MainLayout from './components/layout/MainLayout.jsx';
import MapPage from './components/MapPage.jsx';
import ReportPage from './components/ReportPage.jsx';
import VolunteerAuthPage from './components/VolunteerAuthPage.jsx';
import VolunteerDashboard from './components/VolunteerDashboard.jsx';
import AdminPortal from './components/AdminPortal.jsx';
import { sessionApi, publicApi } from './api.js';

export default function App() {
  const [user, setUser] = useState(null);
  const [authLoading, setAuthLoading] = useState(true);
  const [page, setPage] = useState(() => (window.location.hash === '#admin' ? 'admin' : 'map'));
  const [pos, setPos] = useState(null);
  const [geoError, setGeoError] = useState('');

  // 1. Dengarkan perubahan URL (#admin) agar langsung berpindah tanpa perlu reload halaman
  useEffect(() => {
    const handleHashChange = () => {
      if (window.location.hash === '#admin') {
        setPage('admin');
      }
    };
    window.addEventListener('hashchange', handleHashChange);
    return () => window.removeEventListener('hashchange', handleHashChange);
  }, []);

  // 2. Pulihkan session login (baik Relawan maupun Admin tetap login saat refresh)
  useEffect(() => {
    sessionApi.getSessionProfile().then((profile) => {
      setUser(profile);
      if (profile && ['admin', 'super_admin'].includes(profile.role)) {
        window.location.hash = 'admin';
        setPage('admin');
      } else if (profile?.role === 'volunteer' && window.location.hash !== '#admin') {
        setPage('volunteer');
      }
      setAuthLoading(false);
    });
  }, []);

  // 3. Pantau lokasi GPS perangkat
  useEffect(() => {
    if (!navigator.geolocation) {
      setGeoError('Perangkat tidak mendukung GPS.');
      return;
    }
    const watchId = navigator.geolocation.watchPosition(
      (p) => {
        setPos({ lat: p.coords.latitude, lng: p.coords.longitude, accuracy: p.coords.accuracy });
        setGeoError('');
      },
      (err) => setGeoError(`GPS tidak aktif: ${err.message}`),
      { enableHighAccuracy: true, maximumAge: 5000, timeout: 15000 }
    );
    return () => navigator.geolocation.clearWatch(watchId);
  }, []);

  const handleLogout = async () => {
    await sessionApi.logout();
    setUser(null);
    window.location.hash = '';
    setPage('map');
  };

  if (authLoading) {
    return (
      <div style={{ padding: '40px', textAlign: 'center', color: '#475569' }}>
        Memuat sesi SirkulaAI...
      </div>
    );
  }

  // Portal Admin berdiri sendiri & tetap mempertahankan sesi login Admin
  if (page === 'admin') {
    return (
      <AdminPortal
        currentUser={user}
        onLoginAdmin={(adminProfile) => {
          setUser(adminProfile);
          window.location.hash = 'admin';
          setPage('admin');
        }}
        onLogoutAdmin={handleLogout}
        onBackToPublic={() => {
          window.location.hash = '';
          setPage('map');
        }}
      />
    );
  }

  return (
    <MainLayout
      activePage={page}
      onNavigate={(targetPage) => setPage(targetPage)}
      user={user}
      onOpenAdmin={() => {
        window.location.hash = 'admin';
        setPage('admin');
      }}
    >
      {page === 'map' && (
        <MapPage goReport={() => setPage('report')} />
      )}

      {page === 'report' && (
        <ReportPage
          pos={pos}
          geoError={geoError}
          onSendToBackend={(payload) => publicApi.submitReport(payload)}
          goMap={() => setPage('map')}
        />
      )}

      {page === 'volunteer' && (
        user?.role === 'volunteer' ? (
          <VolunteerDashboard currentUser={user} onLogout={handleLogout} />
        ) : (
          <VolunteerAuthPage
            onRegister={(formPayload) =>
              publicApi.registerVolunteer(formPayload).then((newProfile) => {
                setUser(newProfile);
              })
            }
            onLogin={(email, password) =>
              sessionApi.login(email, password).then(({ user: loggedProfile }) => {
                setUser(loggedProfile);
              })
            }
          />
        )
      )}
    </MainLayout>
  );
}