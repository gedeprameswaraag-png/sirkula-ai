import { supabase } from './supabaseClient';

const API_BASE = import.meta.env.VITE_API_URL || '/api';

async function requestApi(endpoint, options = {}) {
  const { data: { session } } = await supabase.auth.getSession();
  const token = session?.access_token;

  const headers = {
    ...(options.headers || {}),
    ...(token ? { Authorization: `Bearer ${token}` } : {})
  };

  if (!(options.body instanceof FormData) && !headers['Content-Type']) {
    headers['Content-Type'] = 'application/json';
  }

  const res = await fetch(`${API_BASE}${endpoint}`, { ...options, headers });

  // Pastikan respons benar-benar JSON (mencegah error Unexpected token '<')
  const contentType = res.headers.get('content-type') || '';
  if (!contentType.includes('application/json')) {
    throw new Error(`Endpoint ${endpoint} tidak mengembalikan JSON (Status ${res.status}). Pastikan server backend menyala.`);
  }

  const data = await res.json();
  if (!res.ok) {
    throw new Error(data.message || `Gagal memproses permintaan (${res.status}).`);
  }
  return data;
}

// === SESSION & ROLE ===
export const sessionApi = {
  async login(email, password) {
    const { data, error } = await supabase.auth.signInWithPassword({ email, password });
    if (error) {
      if (error.message.toLowerCase().includes('email not confirmed')) {
        throw new Error('Email Anda belum diverifikasi. Silakan buka kotak masuk/spam email Anda dan klik tautan verifikasi terlebih dahulu.');
      }
      throw new Error(error.message);
    }

    if (!data.user?.email_confirmed_at) {
      await supabase.auth.signOut();
      throw new Error('Email Anda belum diverifikasi. Silakan klik tautan verifikasi yang dikirim ke email Anda.');
    }

    const me = await requestApi('/auth/me');
    return { session: data.session, user: me.user };
  },
  async logout() {
    await supabase.auth.signOut();
  },
  async getSessionProfile() {
    const { data: { session } } = await supabase.auth.getSession();
    if (!session) return null;
    try {
      const me = await requestApi('/auth/me');
      return me.user;
    } catch {
      return null;
    }
  }
};

// === JATAH USER / GUEST (TANPA LOGIN) ===
export const publicApi = {
  getHotspots(priorityLevel = '') {
    const qs = priorityLevel ? `?priority_level=${priorityLevel}` : '';
    return requestApi(`/public/hotspots${qs}`);
  },
  getStats() {
    return requestApi('/public/stats');
  },
  submitReport({ blob, pos, description = '' }) {
    const imageFile = new File([blob], `capture-${Date.now()}.jpg`, { type: blob.type || 'image/jpeg' });
    const formData = new FormData();
    formData.append('image', imageFile);
    formData.append('latitude', pos.lat);
    formData.append('longitude', pos.lng);
    formData.append('gps_accuracy_m', pos.accuracy);
    formData.append('location_captured_at', new Date().toISOString());
    formData.append('capture_source', 'camera');
    if (description) formData.append('description', description);

    return requestApi('/reports', { method: 'POST', body: formData });
  },
  async registerVolunteer(payload) {
    // Kirim data pendaftaran ke backend agar Supabase mengirim tautan verifikasi ke email asli
    const reg = await requestApi('/public/volunteers/register', {
      method: 'POST',
      body: JSON.stringify(payload)
    });
    return {
      requiresEmailVerification: true,
      email: reg.email || payload.email,
      message: reg.message || 'Tautan verifikasi telah dikirim ke email Anda. Silakan cek inbox/spam sebelum login.',
      user: reg.user
    };
  },
  async resendVerificationEmail(email) {
    const { error } = await supabase.auth.resend({
      type: 'signup',
      email: email.trim().toLowerCase(),
      options: {
        emailRedirectTo: window.location.origin
      }
    });
    if (error) throw new Error(error.message);
    return { success: true, message: 'Email verifikasi berhasil dikirim ulang. Silakan cek inbox/spam Anda.' };
  }
};