import { useEffect, useRef, useState } from 'react';
import { fileToResizedBlob } from '../utils/image.js';

const MAX_SIDE = 1280;

export default function CameraCapture({ onCapture, disabled, hint }) {
  const videoRef = useRef(null);
  const streamRef = useRef(null);
  const [ready, setReady] = useState(false);
  const [error, setError] = useState('');

  useEffect(() => {
    let cancelled = false;

    async function start() {
      if (!navigator.mediaDevices?.getUserMedia) {
        setError('Kamera hanya bisa dipakai lewat HTTPS atau localhost.');
        return;
      }
      try {
        const stream = await navigator.mediaDevices.getUserMedia({
          video: { facingMode: { ideal: 'environment' }, width: { ideal: 1280 } },
          audio: false,
        });
        if (cancelled) {
          stream.getTracks().forEach((t) => t.stop());
          return;
        }
        streamRef.current = stream;
        videoRef.current.srcObject = stream;
        await videoRef.current.play();
        setReady(true);
      } catch {
        if (!cancelled) setError('Kamera tidak bisa dibuka. Izinkan akses kamera di browser.');
      }
    }

    start();
    return () => {
      cancelled = true;
      streamRef.current?.getTracks().forEach((t) => t.stop());
    };
  }, []);

  const snap = () => {
    const v = videoRef.current;
    if (!v || !v.videoWidth || disabled) return;
    const scale = Math.min(1, MAX_SIDE / Math.max(v.videoWidth, v.videoHeight));
    const canvas = document.createElement('canvas');
    canvas.width = Math.round(v.videoWidth * scale);
    canvas.height = Math.round(v.videoHeight * scale);
    canvas.getContext('2d').drawImage(v, 0, 0, canvas.width, canvas.height);
    canvas.toBlob((b) => b && onCapture(b), 'image/jpeg', 0.82);
  };

  // Cadangan jika getUserMedia gagal: membuka kamera bawaan HP (bukan galeri)
  const onFile = async (e) => {
    const file = e.target.files?.[0];
    if (!file || disabled) return;
    onCapture(await fileToResizedBlob(file, MAX_SIDE));
  };

  return (
    <div className="camera">
      <div className="viewfinder">
        <video ref={videoRef} playsInline muted />
        {!ready && !error && <p className="vf-msg">Membuka kamera…</p>}
        {error && <p className="vf-msg">{error}</p>}
      </div>

      {error ? (
        <label className={`btn primary block ${disabled ? 'off' : ''}`}>
          Buka kamera HP
          <input type="file" accept="image/*" capture="environment" hidden onChange={onFile} disabled={disabled} />
        </label>
      ) : (
        <button className="shutter" onClick={snap} disabled={!ready || disabled} aria-label="Ambil foto" />
      )}
      {disabled && hint && <p className="hint">{hint}</p>}
    </div>
  );
}
