
const test = require("node:test");
const assert = require("node:assert/strict");

const { validateAiAnalysis } = require("./aiValidator");

const validBase = {
    waste_detected: true,
    waste_categories: ["plastic"],
    image_type: "real_photo",
    waste_context: "physical_environment",
    capture_validity: "valid",
    description: "Sampah plastik terlihat di tepi jalan.",
    distribution: "scattered",
    severity: "medium",
    environmental_risk: [],
    uncertainties: [],
};

test("Foto sampah di lingkungan nyata diterima", () => {
    const result = validateAiAnalysis({ ...validBase });

    assert.equal(result.valid, true);
    assert.equal(result.report_eligible, true);
    assert.equal(result.review_required, false);
});

test("Foto layar laptop yang menampilkan sampah tidak layak", () => {
    const result = validateAiAnalysis({
        ...validBase,
        image_type: "real_photo",
        waste_context: "device_screen",
        capture_validity: "invalid",
    });

    assert.equal(result.valid, true);
    assert.equal(result.report_eligible, false);
    assert.equal(result.review_required, false);
});

test("Ilustrasi sampah tidak layak menjadi laporan", () => {
    const result = validateAiAnalysis({
        ...validBase,
        image_type: "illustration",
        waste_context: "digital_content",
        capture_validity: "invalid",
    });

    assert.equal(result.valid, true);
    assert.equal(result.report_eligible, false);
});

test("Foto dengan konteks tidak jelas membutuhkan pemeriksaan", () => {
    const result = validateAiAnalysis({
        ...validBase,
        image_type: "unknown",
        waste_context: "unknown",
        capture_validity: "uncertain",
        uncertainties: ["Konteks gambar tidak dapat dipastikan."],
    });

    assert.equal(result.valid, true);
    assert.equal(result.report_eligible, false);
    assert.equal(result.review_required, true);
});

test("Foto lingkungan bersih tetap merupakan media valid", () => {
    const result = validateAiAnalysis({
        ...validBase,
        waste_detected: false,
        waste_categories: [],
        environmental_risk: [],
        image_type: "real_photo",
        waste_context: "physical_environment",
        capture_validity: "valid",
        distribution: "unknown",
        severity: "low",
    });

    assert.equal(result.valid, true);
    assert.equal(result.report_eligible, true);
});
