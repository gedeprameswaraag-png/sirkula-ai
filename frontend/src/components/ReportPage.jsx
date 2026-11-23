import { useEffect, useState } from 'react';
import CameraCapture from './CameraCapture.jsx';
import { makeThumb } from '../utils/image.js';

export default function ReportPage({ pos, geoError, onSendToBackend, goMap }) {
  const [step, setStep] = useState('camera');
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
        setOutcome({ tone: 'bad', title: 'Foto Tidak Dapat Diterima', body: res.reason || 'Foto tidak valid atau tidak ditemukan tumpukan sampah.', done: false });
      } else if (res.merged_location) {
        setOutcome({
          tone: 'ok',
          title: 'Laporan Digabungkan ke Titik yang Sama',
          body: `Lokasi berjarak ${res.distance_m} m dari "${res.matched_hotspot?.title}". Foto Anda otomatis digabungkan ke titik tersebut tanpa perlu konfirmasi ulang Admin.`,
          thumb, done: true
        });
      } else {
        setOutcome({
          tone: 'ok',
          title: 'Laporan Berhasil Terkirim',
          body: 'Laporan lokasi baru Anda telah dikirim dan menunggu verifikasi Admin sebelum diterbitkan di peta.',
          thumb, done: true
        });
      }
    } catch (err) {
      setOutcome({ tone: 'bad', title: 'Gagal Mengirim Laporan', body: err.message || 'Pastikan server backend sedang menyala.', done: false });
    }
    setStep('outcome');
  };

  const weak = pos && pos.accuracy > 100;
  const gpsText = pos
    ? weak ? `Sinyal GPS lemah (±${Math.round(pos.accuracy)} m)` : `GPS Siap (±${Math.round(pos.accuracy)} m)`
    : geoError || 'Mencari titik koordinat GPS…';

  return (
    <section className="report-page">
      <div className="report-intro">
        <span className="eyebrow">AKSI LINGKUNGAN</span>
        <h1>Laporkan Titik Sampah</h1>
        <p>Ambil foto, biarkan AI membantu memvalidasi, lalu bantu tim menemukan lokasi yang perlu ditangani.</p>
      </div>

      <div className={`gps ${pos && !weak ? 'ok' : pos ? 'warn' : geoError ? 'bad' : ''}`}>
        <span className="gps-dot" />
        <span>{gpsText}</span>
      </div>

      {step === 'camera' && (
        <div className="report-card camera-card">
          <div className="card-kicker">01 · BUKTI FOTO</div>
          <h2>Ambil foto kondisi sampah</h2>
          <p>Pastikan objek terlihat jelas dan lokasi GPS sudah aktif sebelum mengambil foto.</p>
          <CameraCapture
            disabled={!pos}
            hint="Kamera aktif otomatis setelah titik koordinat GPS ditemukan."
            onCapture={(blob) => {
              setShot({ blob, url: URL.createObjectURL(blob), pos });
              setStep('review');
            }}
          />
        </div>
      )}

      {step === 'review' && shot && (
        <div className="report-card review-card">
          <div className="card-kicker">02 · TINJAU</div>
          <h2>Periksa laporan sebelum dikirim</h2>
          <img src={shot.url} alt="Pratinjau foto" />
          <p className="meta">{shot.pos.lat.toFixed(5)}, {shot.pos.lng.toFixed(5)} · ±{Math.round(shot.pos.accuracy)} m</p>
          <input
            className="field"
            type="text"
            value={description}
            onChange={(e) => setDescription(e.target.value)}
            placeholder="Catatan kondisi sampah (opsional)…"
          />
          <div className="action-row">
            <button className="btn" onClick={reset}>Ulangi Foto</button>
            <button className="btn primary" onClick={submit}>Kirim Laporan ↗</button>
          </div>
        </div>
      )}

      {step === 'sending' && (
        <div className="report-card sending">
          <div className="spinner" />
          <h2>Memproses laporan…</h2>
          <p>Mengirim foto & koordinat lokasi ke Sirkula AI.</p>
        </div>
      )}

      {step === 'outcome' && outcome && (
        <div className={`report-card outcome ${outcome.tone}`}>
          <div className="outcome-icon">{outcome.tone === 'ok' ? '✓' : '!'}</div>
          <h2>{outcome.title}</h2>
          <p>{outcome.body}</p>
          {outcome.thumb && <img src={outcome.thumb} alt="Bukti terkirim" />}
          <div className="action-row">
            {outcome.done ? (
              <>
                <button className="btn" onClick={reset}>Lapor Lagi</button>
                <button className="btn primary" onClick={goMap}>Lihat di Peta ↗</button>
              </>
            ) : (
              <button className="btn primary block" onClick={reset}>Ambil Foto Ulang</button>
            )}
          </div>
        </div>
      )}
    </section>
  );
}
