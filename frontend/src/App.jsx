import React, { useEffect, useState } from 'react';
import MainLayout from './components/layout/MainLayout.jsx';
import MapPage from './components/MapPage.jsx';
import ReportPage from './components/ReportPage.jsx';
import VolunteerAuthPage from './components/VolunteerAuthPage.jsx';
import VolunteerDashboard from './components/VolunteerDashboard.jsx';
import AdminPortal from './components/AdminPortal.jsx';
import { sessionApi, publicApi } from './api.js';
import { supabase } from './supabaseClient.js';

export default function App() {
  const [user, setUser] = useState(null);
  const [authLoading, setAuthLoading] = useState(true);
  const [page, setPage] = useState(() => (window.location.hash === '#admin' ? 'admin' : 'map'));
  const [pos, setPos] = useState(null);
  const [geoError, setGeoError] = useState('');
  const [authNotice, setAuthNotice] = useState(null);

  // Titik lokasi yang dipilih dari Dashboard Relawan untuk langsung dibuka di Peta
  const [focusedZone, setFocusedZone] = useState(null);

  // 1. Tangkap callback URL dari link konfirmasi email Supabase
  useEffect(() => {
    const hash = window.location.hash || '';
    if (hash.includes('error_code=otp_expired') || hash.includes('error=access_denied')) {
      setAuthNotice({
        type: 'error',
        message: 'Tautan verifikasi email sudah kedaluwarsa atau tidak valid. Silakan kirim ulang tautan verifikasi baru.'
      });
      setPage('volunteer');
      window.history.replaceState(null, '', window.location.pathname);
    } else if (hash.includes('access_token=') && hash.includes('type=signup')) {
      if (!supabase) {
        setAuthNotice({
          type: 'error',
          message: 'Supabase belum dikonfigurasi. Isi file .env terlebih dahulu.'
        });
        setPage('volunteer');
        window.history.replaceState(null, '', window.location.pathname);
        return;
      }
      supabase.auth.signOut().finally(() => {
        setAuthNotice({
          type: 'success',
          message: 'Email berhasil dikonfirmasi! Silakan masuk menggunakan email dan kata sandi Anda.'
        });
        setPage('volunteer');
        window.history.replaceState(null, '', window.location.pathname);
      });
    }
  }, []);

  // 2. Dengarkan perubahan URL (#admin)
  useEffect(() => {
    const handleHashChange = () => {
      if (window.location.hash === '#admin') {
        setPage('admin');
      }
    };
    window.addEventListener('hashchange', handleHashChange);
    return () => window.removeEventListener('hashchange', handleHashChange);
  }, []);

  // 3. Pulihkan session login saat refresh
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

  // 4. Pantau lokasi GPS perangkat
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
    setFocusedZone(null);
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
      onNavigate={(targetPage) => {
        if (targetPage !== 'map') setFocusedZone(null);
        setPage(targetPage);
      }}
      user={user}
      onOpenAdmin={() => {
        window.location.hash = 'admin';
        setPage('admin');
      }}
    >
      {page === 'map' && (
        <MapPage
          currentUser={user}
          focusedZone={focusedZone}
          onClearFocusedZone={() => setFocusedZone(null)}
          goReport={() => setPage('report')}
          goVolunteerAuth={() => setPage('volunteer')}
          onTaskClaimed={() => {
            setFocusedZone(null);
            setPage('volunteer');
          }}
        />
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
          <VolunteerDashboard
            currentUser={user}
            onLogout={handleLogout}
            onSelectHotspotOnMap={(zone) => {
              setFocusedZone(zone);
              setPage('map');
            }}
          />
        ) : (
          <VolunteerAuthPage
            initialNotice={authNotice}
            onClearNotice={() => setAuthNotice(null)}
            onRegister={(formPayload) => publicApi.registerVolunteer(formPayload)}
            onResendEmail={(email) => publicApi.resendVerificationEmail(email)}
            onLogin={(email, password) =>
              sessionApi.login(email, password).then(({ user: loggedProfile }) => {
                setAuthNotice(null);
                setUser(loggedProfile);
              })
            }
          />
        )
      )}
    </MainLayout>
  );
}