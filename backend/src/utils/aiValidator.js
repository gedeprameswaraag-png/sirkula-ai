
const ALLOWED_CATEGORIES = [
    "plastic",
    "paper_cardboard",
    "organic",
    "glass",
    "metal",
    "textile",
    "e_waste",
    "construction",
    "hazardous",
    "other",
    "unknown",
];

const ALLOWED_DISTRIBUTIONS = [
    "concentrated",
    "scattered",
    "unknown",
];

const ALLOWED_SEVERITIES = [
    "low",
    "medium",
    "high",
    "unknown",
];

const ALLOWED_IMAGE_TYPES = [
    "real_photo",
    "illustration",
    "screenshot",
    "printed_image",
    "unknown",
];

const ALLOWED_WASTE_CONTEXTS = [
    "physical_environment",
    "device_screen",
    "printed_surface",
    "digital_content",
    "unknown",
];

const ALLOWED_CAPTURE_VALIDITIES = [
    "valid",
    "invalid",
    "uncertain",
];

function validateAiAnalysis(data) {
    const errors = [];

    if (!data || typeof data !== "object" || Array.isArray(data)) {
        return {
            valid: false,
            errors: ["Hasil AI harus berupa objek JSON."],
        };
    }

    if (typeof data.waste_detected !== "boolean") {
        errors.push("waste_detected harus berupa boolean.");
    }

    if (
        !Array.isArray(data.waste_categories) ||
        !data.waste_categories.every(
            (category) =>
                typeof category === "string" &&
                ALLOWED_CATEGORIES.includes(category)
        )
    ) {
        errors.push("waste_categories tidak valid.");
    }

    if (
        typeof data.description !== "string" ||
        data.description.trim() === ""
    ) {
        errors.push("description harus berupa teks dan tidak boleh kosong.");
    }

    if (!ALLOWED_DISTRIBUTIONS.includes(data.distribution)) {
        errors.push("distribution tidak sesuai pilihan.");
    }

    if (!ALLOWED_SEVERITIES.includes(data.severity)) {
        errors.push("severity tidak sesuai pilihan.");
    }

    if (
        !Array.isArray(data.environmental_risk) ||
        !data.environmental_risk.every(
            (risk) => typeof risk === "string"
        )
    ) {
        errors.push("environmental_risk harus berupa array teks.");
    }

    if (
        !Array.isArray(data.uncertainties) ||
        !data.uncertainties.every(
            (item) => typeof item === "string"
        )
    ) {
        errors.push("uncertainties harus berupa array teks.");
    }

    // Validasi jenis gambar
    if (!ALLOWED_IMAGE_TYPES.includes(data.image_type)) {
        errors.push("image_type tidak sesuai pilihan.");
    }

    // Validasi konteks keberadaan sampah
    if (!ALLOWED_WASTE_CONTEXTS.includes(data.waste_context)) {
        errors.push("waste_context tidak sesuai pilihan.");
    }

    // Validasi kelayakan foto
    if (!ALLOWED_CAPTURE_VALIDITIES.includes(data.capture_validity)) {
        errors.push("capture_validity tidak sesuai pilihan.");
    }

    // Konsistensi hasil deteksi sampah
    if (
        data.waste_detected === false &&
        Array.isArray(data.waste_categories) &&
        data.waste_categories.length > 0
    ) {
        errors.push(
            "Jika tidak ada sampah terdeteksi, waste_categories harus kosong."
        );
    }

    if (
        data.waste_detected === false &&
        Array.isArray(data.environmental_risk) &&
        data.environmental_risk.length > 0
    ) {
        errors.push(
            "Jika tidak ada sampah terdeteksi, environmental_risk harus kosong."
        );
    }

    // Konsistensi konteks gambar dengan kelayakan laporan
    if (
        data.capture_validity === "valid" &&
        (
            data.image_type !== "real_photo" ||
            data.waste_context !== "physical_environment"
        )
    ) {
        errors.push(
            "Foto valid harus berupa foto nyata dengan konteks lingkungan fisik."
        );
    }

    if (
        data.capture_validity === "uncertain" &&
        (
            data.image_type === "unknown" ||
            data.waste_context === "unknown"
        ) &&
        !Array.isArray(data.uncertainties)
    ) {
        errors.push(
            "Ketidakpastian gambar harus dijelaskan."
        );
    }

    const schemaValid = errors.length === 0;

    const reportEligible =
        schemaValid &&
        data.capture_validity === "valid" &&
        data.image_type === "real_photo" &&
        data.waste_context === "physical_environment";

    const reviewRequired =
        schemaValid && data.capture_validity === "uncertain";

    return {
        valid: schemaValid,
        report_eligible: reportEligible,
        review_required: reviewRequired,
        errors,
    };
}

module.exports = { validateAiAnalysis };
