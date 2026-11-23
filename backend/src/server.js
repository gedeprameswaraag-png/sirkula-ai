require("dotenv").config();

const express = require("express");
const cors = require("cors");

const app = express();
const aiRoutes = require("./routes/aiRoutes");
const apiRoutes = require("./routes/apiRoutes");

app.use(cors());
app.use(express.json());

app.get("/", (req, res) => {
  res.json({
    message: "SirkulaAI Backend is running!",
  });
});

// Daftarkan rute utama SirkulaAI (auth, public, reports, volunteer, admin)
app.use("/api", apiRoutes);

// Daftarkan rute AI analisis
app.use("/api/ai", aiRoutes);

// Global Error Handler: pastikan semua error (400/401/403/500) dikembalikan dalam format JSON
app.use((err, req, res, next) => {
  console.error("[API Error]:", err.message);
  const status = err.statusCode || err.status || 500;
  res.status(status).json({
    success: false,
    message: err.message || "Terjadi kesalahan pada server."
  });
});

const PORT = process.env.PORT || 5000;
app.listen(PORT, () => {
  console.log(`Server berjalan di http://localhost:${PORT}`);
});