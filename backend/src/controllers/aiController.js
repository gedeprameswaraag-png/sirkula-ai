const ai = require("../config/gemini");
const { validateAiAnalysis } = require("../utils/aiValidator");

const MODEL_NAME = process.env.GEMINI_MODEL || "gemini-2.5-flash";
const RETRYABLE_STATUS = [500, 502, 503, 504];

const getErrorStatus = (error) => {
    const status = Number(
        error.status ||
        error.code ||
        error.response?.status
    );

    if ([400, 401, 403, 404, 429, ...RETRYABLE_STATUS].includes(status)) {
        return status;
    }

    const message = String(error.message || "").toLowerCase();

    if (message.includes("429") || message.includes("resource_exhausted")) {
        return 429;
    }

    if (
        message.includes("503") ||
        message.includes("unavailable") ||
        message.includes("overloaded")
    ) {
        return 503;
    }

    if (message.includes("not found") || message.includes("404")) {
        return 404;
    }

    if (message.includes("api key") || message.includes("permission")) {
        return 403;
    }

    return status || 500;
};

const sleep = (ms) => new Promise((resolve) => setTimeout(resolve, ms));

// Retry hanya untuk gangguan sementara (5xx). 429 tidak diulang.
const generateWithRetry = async (request, maxRetries = 2) => {
    let lastError;

    for (let attempt = 0; attempt <= maxRetries; attempt++) {
        try {
            return await ai.models.generateContent(request);
        } catch (error) {
            lastError = error;
            const status = getErrorStatus(error);

            if (!RETRYABLE_STATUS.includes(status) || attempt === maxRetries) {
                throw error;
            }

            await sleep(1000 * 2 ** attempt);
        }
    }

    throw lastError;
};

const PROMPT = `
Kamu adalah AI Computer Vision untuk SirkulaAI,
sistem pelaporan dan pemetaan hotspot sampah di lingkungan nyata.

Tugasmu adalah mengidentifikasi sampah sekaligus menentukan
apakah sampah tersebut benar-benar berada di lingkungan fisik
atau hanya ditampilkan melalui media lain.

Kembalikan JSON valid saja dengan struktur:

{
"waste_detected": true,
"waste_categories": ["plastic"],
"image_type": "real_photo",
"waste_context": "physical_environment",
"capture_validity": "valid",
"description": "Deskripsi objek yang terlihat",
"distribution": "concentrated",
"severity": "medium",
"environmental_risk": [],
"uncertainties": []
}

ATURAN IDENTIFIKASI:

1. image_type hanya boleh:
- real_photo
- illustration
- screenshot
- printed_image
- unknown

2. waste_context hanya boleh:
- physical_environment
- device_screen
- printed_surface
- digital_content
- unknown

3. capture_validity hanya boleh:
- valid
- invalid
- uncertain

4. Jika sampah benar-benar terlihat berada di lingkungan
fisik, seperti jalan, sungai, tanah, selokan, atau lahan,
dan tidak terlihat sebagai objek pada media lain:
- image_type = real_photo
- waste_context = physical_environment
- capture_validity = valid

5. Jika gambar merupakan ilustrasi, gambar digital,
screenshot, atau poster:
- capture_validity = invalid

6. Jika kamera memotret layar HP, tablet, laptop, monitor,
televisi, atau perangkat lain yang menampilkan gambar sampah:
- image_type = real_photo
- waste_context = device_screen
- capture_validity = invalid

7. Jika kamera memotret foto cetak, poster, atau gambar
sampah pada permukaan fisik:
- waste_context = printed_surface
- capture_validity = invalid

8. Jika konteks gambar tidak dapat dipastikan:
- gunakan unknown pada field yang tidak dapat dipastikan
- capture_validity = uncertain
- jelaskan ketidakpastiannya

9. Jangan menyatakan gambar valid hanya karena terdapat
sampah yang terlihat.

10. Jika gambar tidak valid atau tidak pasti, jangan
menganggap sampah tersebut sebagai hotspot lingkungan nyata.

ATURAN ANALISIS SAMPAH:

- waste_detected harus boolean.
- waste_categories harus berupa array.
- Kategori hanya boleh:
plastic, paper_cardboard, organic, glass, metal,
textile, e_waste, construction, hazardous, other, unknown.
- distribution hanya boleh:
concentrated, scattered, unknown.
- severity hanya boleh:
low, medium, high, unknown.
- environmental_risk harus berupa array.
- uncertainties harus berupa array.
- Jangan mengarang berat atau volume sampah.
- Severity dan risiko hanya perkiraan visual.

Jika waste_detected bernilai false:
- waste_categories harus kosong.
- environmental_risk harus kosong.
- severity harus low atau unknown.
- distribution harus unknown.

PENTING:
Prioritaskan konteks keberadaan objek daripada sekadar
mengenali bentuk sampah. Jika sampah hanya terlihat pada
layar atau gambar, jangan nyatakan laporan valid.
`;

const analyzeImage = async (req, res) => {
    try {
        if (!req.file) {
            return res.status(400).json({
                success: false,
                message: "Gambar wajib diunggah.",
            });
        }

        const imageBase64 = req.file.buffer.toString("base64");

        const response = await generateWithRetry({
            model: MODEL_NAME,
            contents: [
                {
                    inlineData: {
                        mimeType: req.file.mimetype,
                        data: imageBase64,
                    },
                },
                PROMPT,
            ],
            config: {
                responseMimeType: "application/json",
            },
        });

        if (!response.text) {
            return res.status(502).json({
                success: false,
                message: "AI memberikan respons kosong.",
            });
        }

        let analysis;

        try {
            analysis = JSON.parse(response.text);
        } catch (parseError) {
            console.error("Gemini returned invalid JSON:", parseError.message);

            return res.status(502).json({
                success: false,
                message: "AI menghasilkan format respons yang tidak valid.",
            });
        }

        const validation = validateAiAnalysis(analysis);

        if (!validation.valid) {
            console.error("AI Validation Failed:", validation.errors);

            return res.status(502).json({
                success: false,
                message: "Hasil analisis AI tidak sesuai format sistem.",
            });
        }

        if (!validation.report_eligible) {
            if (validation.review_required) {
                return res.status(200).json({
                    success: true,
                    message: "Analisis berhasil, tetapi gambar memerlukan pemeriksaan admin.",
                    report_eligible: false,
                    review_required: true,
                    data: analysis,
                });
            }

            return res.status(200).json({
                success: true,
                message: "Analisis berhasil, tetapi gambar tidak memenuhi kriteria laporan hotspot.",
                report_eligible: false,
                review_required: false,
                data: analysis,
            });
        }

        return res.status(200).json({
            success: true,
            message: "Analisis gambar berhasil.",
            report_eligible: true,
            review_required: false,
            data: analysis,
        });
    } catch (error) {
        const status = getErrorStatus(error);

        console.error("[Gemini ERROR]", {
            model: MODEL_NAME,
            status,
            message: error.message,
        });

        if (status === 404) {
            return res.status(500).json({
                success: false,
                message: `Model AI "${MODEL_NAME}" tidak ditemukan. Periksa GEMINI_MODEL.`,
            });
        }

        if (status === 400 || status === 401 || status === 403) {
            return res.status(500).json({
                success: false,
                message: "API key Gemini tidak valid atau tidak memiliki izin.",
            });
        }

        if (status === 429) {
            return res.status(429).json({
                success: false,
                message: "Layanan AI sedang mencapai batas permintaan. Coba lagi beberapa saat.",
            });
        }

        if (RETRYABLE_STATUS.includes(status)) {
            return res.status(503).json({
                success: false,
                message: "Layanan AI sedang mengalami gangguan. Silakan coba kembali.",
            });
        }

        return res.status(500).json({
            success: false,
            message: "Terjadi kesalahan saat menganalisis gambar.",
        });
    }
};

module.exports = { analyzeImage };