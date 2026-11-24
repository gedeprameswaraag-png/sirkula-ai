<div align="center">

<h1>♻️ Sirkula-AI</h1>
<p><strong>Platform Pelaporan &amp; Pemetaan Cerdas Pengelolaan Sampah Lingkungan Berbasis Hybrid Computer Vision</strong></p>

<p>
  <img src="https://img.shields.io/badge/AI-Gemini%203.5%20Flash%20Lite-4285F4?style=for-the-badge&logo=google&logoColor=white" alt="Gemini AI" />
  <img src="https://img.shields.io/badge/Fallback-YOLOv8%20ONNX-005CED?style=for-the-badge&logo=onnx&logoColor=white" alt="ONNX" />
  <img src="https://img.shields.io/badge/Backend-Node.js%20%26%20Express-339933?style=for-the-badge&logo=nodedotjs&logoColor=white" alt="Node.js" />
  <img src="https://img.shields.io/badge/AI%20Service-FastAPI%20Python-009688?style=for-the-badge&logo=fastapi&logoColor=white" alt="FastAPI" />
  <img src="https://img.shields.io/badge/Frontend-React%20%2B%20Vite-61DAFB?style=for-the-badge&logo=react&logoColor=black" alt="React" />
  <img src="https://img.shields.io/badge/Database-Supabase-3ECF8E?style=for-the-badge&logo=supabase&logoColor=white" alt="Supabase" />
</p>

<p>
  <a href="#-mengapa-sirkula-ai">Mengapa Sirkula-AI</a> •
  <a href="#-fitur-unggulan">Fitur Unggulan</a> •
  <a href="#-arsitektur-hybrid-ai">Arsitektur Sistem</a> •
  <a href="#-instalasi--menjalankan">Cara Menjalankan</a> •
  <a href="#-api-endpoints">API Endpoints</a> •
  <a href="#-transparansi-penggunaan-ai">Transparansi AI</a>
</p>

</div>

---

## 🌍 Mengapa Sirkula-AI?

Laporan sampah konvensional sering gagal ditindaklanjuti karena **3 masalah klasik**: foto buram atau spam yang membebani admin, puluhan laporan duplikat di titik lokasi yang sama, serta penilaian tingkat keparahan yang bersifat subjektif.

**Sirkula-AI** mengubah kamera ponsel warga menjadi sensor lingkungan cerdas yang:
1. **Menyaring kualitas visual secara instan** sebelum laporan masuk ke basis data.
2. **Mengukur luas nyata tumpukan sampah ($m^2$)** dan mengklasifikasikan jenis objeknya.
3. **Menyatukan berbagai sudut foto warga** dalam radius 30 meter menjadi satu *hotspot* prioritas yang objektif.

---

## ✨ Fitur Unggulan

| Fitur | Cara Kerja & Nilai Tambah |
| :--- | :--- |
| 🧠 **Hybrid Dual-AI Vision** | Menggunakan **Google Gemini (`gemini-3.5-flash-lite`)** sebagai otak analisis utama dan otomatis beralih (*failover*) ke server lokal **YOLOv8 ONNX (`best.onnx`)** jika kuota API habis atau koneksi *cloud* terganggu. |
| 🎯 **3-Way Smart Classification** | Membedakan secara tegas antara **Foto Tidak Layak** (`invalid_photo` — buram/gelap/goyang), **Lokasi Bersih** (`clean_location` — tajam & bebas sampah, dicatat sebagai log pantauan), dan **Sampah Terdeteksi** (`waste_detected`). |
| 📐 **Estimasi Luas Fisik ($m^2$)** | Menghitung luas area sampah dan tumpukan dalam satuan meter persegi beserta 6 kelas objek (`garbage_pile`, `plastic`, `organic`, `paper_cardboard`, `metal_glass`, `hazardous`). |
| 📍 **Multi-Angle Hotspot Fusion** | Laporan baru dalam radius $\le 30\text{ m}$ otomatis digabung ke *hotspot* terdekat dengan bobot **60% skor titik terparah + 25% rata-rata kepadatan sudut + bonus sebaran area**. |
| 🔒 **Privat & Terverifikasi GPS** | Foto bukti disimpan aman di Supabase Private Bucket dengan *Signed URL* dan dikunci koordinat GPS saat pengambilan gambar. |

---

## 🏗️ Arsitektur Hybrid AI

```mermaid
flowchart LR
    A[📱 Frontend React + Vite<br/>Kamera & GPS] -->|Multipart Form| B[⚙️ Backend Node.js + Express<br/>Orkestrasi & Hotspot Fusion]
    B -->|1. Primary Vision| C[☁️ Google Gemini API<br/>gemini-3.5-flash-lite]
    C -.->|2. Auto Failover<br/>Jika 429 / Error| D[🐍 Python FastAPI<br/>YOLOv8 best.onnx]
    B -->|3. Simpan Data & Foto| E[(🗄️ Supabase<br/>PostgreSQL + Storage)]
