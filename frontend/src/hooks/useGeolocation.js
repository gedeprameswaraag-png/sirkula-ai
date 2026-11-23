import { useEffect, useState } from 'react';

const MESSAGES = {
  1: 'Izin lokasi ditolak. Aktifkan izin lokasi di pengaturan browser.',
  2: 'Lokasi tidak tersedia. Pindah ke tempat terbuka lalu coba lagi.',
  3: 'Pencarian lokasi terlalu lama. Coba lagi.',
};

export function useGeolocation() {
  const [pos, setPos] = useState(null);
  const [error, setError] = useState('');

  useEffect(() => {
    if (!('geolocation' in navigator)) {
      setError('Browser ini tidak mendukung GPS.');
      return undefined;
    }
    const id = navigator.geolocation.watchPosition(
      (p) => {
        setError('');
        setPos({
          lat: p.coords.latitude,
          lng: p.coords.longitude,
          accuracy: p.coords.accuracy,
          at: p.timestamp,
        });
      },
      (e) => setError(MESSAGES[e.code] || 'Gagal membaca lokasi.'),
      { enableHighAccuracy: true, maximumAge: 5000, timeout: 20000 }
    );
    return () => navigator.geolocation.clearWatch(id);
  }, []);

  return { pos, error };
}
