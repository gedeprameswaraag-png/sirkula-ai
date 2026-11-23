
const express = require("express");
const multer = require("multer");
const { analyzeImage } = require("../controllers/aiController");

const router = express.Router();

const allowedTypes = ["image/jpeg", "image/png", "image/webp"];

const upload = multer({
    storage: multer.memoryStorage(),
    limits: {
        fileSize: 5 * 1024 * 1024,
        files: 1,
    },
    fileFilter: (req, file, cb) => {
        if (!allowedTypes.includes(file.mimetype)) {
            const error = new Error("Format gambar harus JPG, PNG, atau WEBP.");
            error.code = "INVALID_FILE_TYPE";
            return cb(error);
        }

        cb(null, true);
    },
});

// Memeriksa signature file, bukan hanya MIME type.
const validateImageSignature = (req, res, next) => {
    if (!req.file) {
        return next();
    }

    const buffer = req.file.buffer;

    const isJPEG =
        buffer.length >= 3 &&
        buffer[0] === 0xff &&
        buffer[1] === 0xd8 &&
        buffer[2] === 0xff;

    const isPNG =
        buffer.length >= 8 &&
        buffer.subarray(0, 8).equals(
            Buffer.from([0x89, 0x50, 0x4e, 0x47, 0x0d, 0x0a, 0x1a, 0x0a])
        );

    const isWEBP =
        buffer.length >= 12 &&
        buffer.toString("ascii", 0, 4) === "RIFF" &&
        buffer.toString("ascii", 8, 12) === "WEBP";

    if (!isJPEG && !isPNG && !isWEBP) {
        return res.status(415).json({
            success: false,
            message: "Isi file bukan gambar JPG, PNG, atau WEBP yang valid.",
        });
    }

    next();
};

// Menangani error dari Multer.
const handleUploadError = (err, req, res, next) => {
    if (err instanceof multer.MulterError) {
        if (err.code === "LIMIT_FILE_SIZE") {
            return res.status(413).json({
                success: false,
                message: "Ukuran gambar maksimal 5 MB.",
            });
        }

        return res.status(400).json({
            success: false,
            message: "Upload gambar tidak valid.",
        });
    }

    if (err.code === "INVALID_FILE_TYPE") {
        return res.status(415).json({
            success: false,
            message: err.message,
        });
    }

    console.error("Upload Error:", err.message);

    return res.status(500).json({
        success: false,
        message: "Terjadi kesalahan saat mengunggah gambar.",
    });
};

router.post(
    "/test",
    upload.single("image"),
    validateImageSignature,
    analyzeImage,
    handleUploadError
);

module.exports = router;
