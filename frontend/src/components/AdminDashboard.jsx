// E:\PROJEK\sirkula-ai\frontend\src\components\AdminDashboard.jsx
import React, { useEffect, useState } from 'react';
import { adminApi, publicApi } from '../api';

export default function AdminDashboard() {
  const [reports, setReports] = useState([]);
  const [hotspots, setHotspots] = useState([]);
  const [volunteers, setVolunteers] = useState([]);
  const [selectedVolunteer, setSelectedVolunteer] = useState({});
  const [loading, setLoading] = useState(true);

  const loadData = async () => {
    try {
      setLoading(true);
      const [repRes, hsRes, volRes] = await Promise.all([
        adminApi.getAllReports(),
        publicApi.getHotspots(),
        adminApi.getVolunteers()
      ]);
      setReports(repRes.reports || []);
      setHotspots(hsRes.hotspots || []);
      setVolunteers(volRes.volunteers || []);
    } catch (err) {
      alert(`Gagal memuat data admin: ${err.message}`);
    } finally {
      setLoading(false);
    }
  };

  useEffect(() => {
    loadData();
  }, []);

  const handleVerify = async (reportId, decision) => {
    const reason = decision === 'rejected' ? prompt('Alasan penolakan laporan:') : 'Terverifikasi oleh Admin';
    if (decision === 'rejected' && !reason) return;

    try {
      await adminApi.verifyReport(reportId, { decision, reason });
      alert(`Laporan berhasil diubah menjadi: ${decision}`);
      loadData();
    } catch (err) {
      alert(err.message);
    }
  };

  const handleAssign = async (hotspotId) => {
    const volunteerId = selectedVolunteer[hotspotId];
    if (!volunteerId) return alert('Pilih sukarelawan terlebih dahulu.');

    try {
      await adminApi.assignTask({
        hotspot_id: hotspotId,
        assigned_to: volunteerId
      });
      alert('Tugas pembersihan berhasil dikirim ke sukarelawan!');
      loadData();
    } catch (err) {
      alert(err.message);
    }
  };

  if (loading) return <p style={{ padding: '20px' }}>Memuat dashboard admin...</p>;

  return (
    <div style={{ padding: '20px', maxWidth: '1000px', margin: '0 auto' }}>
      <h2>Dashboard Verifikasi Admin</h2>

      <h3>1. Antrean Laporan Masuk ({reports.length})</h3>
      <div style={{ display: 'grid', gap: '12px', marginBottom: '32px' }}>
        {reports.map((r) => {
          const ai = r.ai_analyses;
          return (
            <div key={r.id} style={{ border: '1px solid #cbd5e1', borderRadius: '8px', padding: '14px', display: 'flex', gap: '16px', flexWrap: 'wrap', background: '#fff' }}>
              {r.photo_url && (
                <img src={r.photo_url} alt="Bukti" style={{ width: '140px', height: '140px', objectFit: 'cover', borderRadius: '6px' }} />
              )}
              <div style={{ flex: 1, minWidth: '240px' }}>
                <div>
                  <strong>Status:</strong> <span style={{ padding: '2px 8px', background: '#e2e8f0', borderRadius: '4px' }}>{r.status}</span>
                  {ai?.is_hazardous && <span style={{ marginLeft: '8px', padding: '2px 8px', background: '#fee2e2', color: '#b91c1c', borderRadius: '4px', fontWeight: 'bold' }}>LIMBAH B3 / BERBAHAYA</span>}
                </div>
                <p style={{ margin: '6px 0' }}><strong>Deskripsi:</strong> {r.description || '-'}</p>
                <p style={{ margin: '4px 0', fontSize: '0.9rem' }}>
                  <strong>Lokasi:</strong> {r.latitude.toFixed(5)}, {r.longitude.toFixed(5)} (Akurasi ±{Math.round(r.gps_accuracy_m)}m)
                </p>
                {ai && (
                  <p style={{ margin: '4px 0', fontSize: '0.9rem', color: '#0f766e' }}>
                    <strong>Analisis AI:</strong> Kategori {ai.result_json?.waste_category?.join(', ') || '-'} | Priority Score: <b>{ai.priority_score}</b> ({ai.priority_level})
                  </p>
                )}

                {['pending_ai', 'analysis_completed', 'analysis_failed', 'needs_more_evidence'].includes(r.status) && (
                  <div style={{ marginTop: '10px', display: 'flex', gap: '8px' }}>
                    <button onClick={() => handleVerify(r.id, 'verified')} style={{ padding: '6px 12px', background: '#16a34a', color: '#fff', border: 'none', borderRadius: '4px', cursor: 'pointer' }}>
                      Verifikasi & Terbitkan Hotspot
                    </button>
                    <button onClick={() => handleVerify(r.id, 'rejected')} style={{ padding: '6px 12px', background: '#dc2626', color: '#fff', border: 'none', borderRadius: '4px', cursor: 'pointer' }}>
                      Tolak
                    </button>
                  </div>
                )}
              </div>
            </div>
          );
        })}
      </div>

      <h3>2. Tugaskan Sukarelawan ke Hotspot Aktif ({hotspots.length})</h3>
      <div style={{ display: 'grid', gap: '12px' }}>
        {hotspots.map((h) => (
          <div key={h.id} style={{ border: '1px solid #cbd5e1', borderRadius: '8px', padding: '14px', background: '#f8fafc', display: 'flex', justifyContent: 'space-between', alignItems: 'center', flexWrap: 'wrap', gap: '10px' }}>
            <div>
              <strong>{h.title}</strong> — <small>Status: <b>{h.status}</b> | Skor: {h.priority_score} ({h.priority_level})</small>
              <div style={{ fontSize: '0.85rem', color: '#475569' }}>Koordinat: {h.latitude}, {h.longitude}</div>
            </div>

            {h.status === 'active' && !h.is_hazardous && (
              <div style={{ display: 'flex', gap: '8px' }}>
                <select
                  value={selectedVolunteer[h.id] || ''}
                  onChange={(e) => setSelectedVolunteer({ ...selectedVolunteer, [h.id]: e.target.value })}
                  style={{ padding: '6px', borderRadius: '4px' }}
                >
                  <option value="">-- Pilih Sukarelawan --</option>
                  {volunteers.map((v) => (
                    <option key={v.id} value={v.id}>{v.full_name}</option>
                  ))}
                </select>
                <button onClick={() => handleAssign(h.id)} style={{ padding: '6px 12px', background: '#2563eb', color: '#fff', border: 'none', borderRadius: '4px', cursor: 'pointer' }}>
                  Tugaskan
                </button>
              </div>
            )}
            {h.is_hazardous && <span style={{ color: '#b91c1c', fontSize: '0.85rem' }}>Eskalasi Khusus (Non-Relawan)</span>}
          </div>
        ))}
      </div>
    </div>
  );
}