import { useEffect, useState } from 'react';
import CameraCapture from './CameraCapture.jsx';
import { makeThumb } from '../utils/image.js';

export default function ReportPage({ pos, geoError, onSendToBackend, goMap }) {
  const [step, setStep] = useState('camera'); // camera | review | sending | outcome
  const [shot, setShot] = useState(null);
  const [description, setDescription] = useState('');
  const [outcome, setOutcome] = useState(null);

  useEffect(() => () => shot?.url && URL.revokeObjectURL(shot.url), [shot]);

  const reset = () => {
    setShot(null);
    setDescription('');
    setOutcome(null);
    setStep('camera');
  };

  const submit = async () => {
    setStep('sending');
    const thumb = await makeThumb(shot.blob).catch(() => shot.url);
    try {
      const res = await onSendToBackend({
        blob: shot.blob,
        pos: shot.pos,
        description: description.trim()
      });

      if (res.rejected_by_ai) {
        setOutcome({
          tone: 'bad',
          title: 'Foto Tidak Dapat Diterima',
          body: res.reason || 'Foto tidak valid atau tidak ditemukan tumpukan sampah.',
          done: false
        });
      } else if (res.merged_location) {
        setOutcome({
          tone: 'ok',
          title: 'Laporan Digabungkan ke Titik yang Sama',
          body: `Lokasi berjarak ${res.distance_m} m dari "${res.matched_hotspot?.title}". Foto Anda otomatis digabungkan ke titik tersebut tanpa perlu konfirmasi ulang Admin.`,
          thumb,
          done: true
        });
      } else {
        setOutcome({
          tone: 'ok',
          title: 'Laporan Berhasil Terkirim',
          body: 'Laporan lokasi baru Anda telah dikirim dan menunggu verifikasi Admin sebelum diterbitkan di peta.',
          thumb,
          done: true
        });
      }
    } catch (err) {
      setOutcome({
        tone: 'bad',
        title: 'Gagal Mengirim Laporan',
        body: err.message || 'Pastikan server backend sedang menyala.',
        done: false
      });
    }
    setStep('outcome');
  };

  const weak = pos && pos.accuracy > 100;
  const gpsText = pos
    ? weak
      ? `Sinyal GPS lemah (±${Math.round(pos.accuracy)} m)`
      : `GPS Siap (±${Math.round(pos.accuracy)} m)`
    : geoError || 'Mencari titik koordinat GPS…';

  return (
    <section className="page report" style={{ maxWidth: '580px', margin: '0 auto', padding: '20px 16px' }}>
      <h2 style={{ margin: '0 0 4px 0', fontSize: '1.25rem' }}>Laporkan Titik Sampah</h2>
      <p style={{ margin: '0 0 14px 0', fontSize: '0.88rem', color: '#64748b' }}>
        Pengunjung dapat langsung mengambil foto kamera dan mengirim laporan tanpa login.
      </p>

      <div className={`gps ${pos && !weak ? 'ok' : pos ? 'warn' : geoError ? 'bad' : ''}`} style={{ marginBottom: '14px' }}>
        {gpsText}
      </div>

      {step === 'camera' && (
        <CameraCapture
          disabled={!pos}
          hint="Kamera aktif otomatis setelah titik koordinat GPS ditemukan."
          onCapture={(blob) => {
            setShot({ blob, url: URL.createObjectURL(blob), pos });
            setStep('review');
          }}
        />
      )}

      {step === 'review' && shot && (
        <div className="review" style={{ background: '#fff', padding: '16px', borderRadius: '12px', border: '1px solid #e2e8f0' }}>
          <img src={shot.url} alt="Pratinjau foto" style={{ width: '100%', borderRadius: '8px', maxHeight: '320px', objectFit: 'cover' }} />
          <p className="meta" style={{ margin: '8px 0', fontSize: '0.82rem', color: '#475569' }}>
            {shot.pos.lat.toFixed(5)}, {shot.pos.lng.toFixed(5)} · ±{Math.round(shot.pos.accuracy)} m
          </p>
          <input
            type="text"
            value={description}
            onChange={(e) => setDescription(e.target.value)}
            placeholder="Catatan kondisi sampah (opsional)..."
            style={{ width: '100%', padding: '10px', borderRadius: '8px', border: '1px solid #cbd5e1', marginBottom: '12px' }}
          />
          <div className="row" style={{ display: 'flex', gap: '10px' }}>
            <button className="btn" onClick={reset} style={{ flex: 1 }}>Ulangi Foto</button>
            <button className="btn primary" onClick={submit} style={{ flex: 1, background: '#0f766e', color: '#fff' }}>Kirim Laporan</button>
          </div>
        </div>
      )}

      {step === 'sending' && (
        <div className="sending" style={{ textAlign: 'center', padding: '40px 0' }}>
          <div className="spinner" />
          <p>Mengirim foto & koordinat lokasi…</p>
        </div>
      )}

      {step === 'outcome' && outcome && (
        <div className={`outcome ${outcome.tone}`} style={{ background: '#fff', padding: '20px', borderRadius: '12px', border: '1px solid #cbd5e1' }}>
          <h2 style={{ marginTop: 0 }}>{outcome.title}</h2>
          <p>{outcome.body}</p>
          {outcome.thumb && (
            <img src={outcome.thumb} alt="Bukti terkirim" style={{ width: '100%', maxHeight: '180px', objectFit: 'cover', borderRadius: '8px', margin: '10px 0' }} />
          )}
          <div className="row" style={{ display: 'flex', gap: '10px', marginTop: '12px' }}>
            {outcome.done ? (
              <>
                <button className="btn" onClick={reset} style={{ flex: 1 }}>Lapor Lagi</button>
                <button className="btn primary" onClick={goMap} style={{ flex: 1, background: '#0f766e', color: '#fff' }}>Lihat di Peta</button>
              </>
            ) : (
              <button className="btn primary" onClick={reset} style={{ width: '100%' }}>Ambil Foto Ulang</button>
            )}
          </div>
        </div>
      )}
    </section>
  );
}