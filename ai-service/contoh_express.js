// Contoh pemakaian di backend Express (Node 18+). VISION_URL = alamat api.py, mis. http://localhost:8000
const VISION_URL = process.env.VISION_URL || 'http://localhost:8000';

async function analisisFoto(buffer, mimetype, namaFile, jarak) {
  const form = new FormData();
  form.append('foto', new Blob([buffer], { type: mimetype }), namaFile || 'foto.jpg');
  if (jarak) form.append('jarak', jarak); // 'dekat' | 'sedang' | 'jauh' (opsional, dari form pelapor)
  const res = await fetch(`${VISION_URL}/analyze`, { method: 'POST', body: form });
  if (!res.ok) throw new Error(`Vision API ${res.status}`);
  return res.json();
}

// Di route (multer memoryStorage):
// const hasil = await analisisFoto(req.file.buffer, req.file.mimetype, req.file.originalname, req.body.jarak);
// switch (hasil.status) {
//   case 'foto_ulang':     return res.status(422).json({ pesan: hasil.alasan[0] });   // minta pelapor foto ulang
//   case 'valid_otomatis': /* simpan laporan: hasil.level, hasil.luas_sampah_m2, hasil.versi_config */ break;
//   case 'tinjau_admin':   /* (opsional) panggil Gemini sebagai pemeriksa kedua HANYA di sini agar hemat kuota,
//                              lalu simpan dengan status "menunggu validasi admin" */ break;
// }
module.exports = { analisisFoto };
