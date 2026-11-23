"""
SirkulaAI - penyempurnaan hasil deteksi YOLO (tanpa melatih ulang model).

Tiga masalah yang diselesaikan:
  1. Objek buram/di luar fokus terdeteksi sebagai sampah  -> filter ketajaman relatif (blur gate)
  2. Luas dibanding ukuran foto menyesatkan (foto dekat vs jauh) -> estimasi skala dunia nyata (m2)
  3. Kotak menyertakan area bersih di sela-sela sampah -> segmentasi GrabCut di dalam kotak
"""
import cv2
import numpy as np

# ===== KALIBRASI (ubah sesuai kondisi nyata dataset Anda) =====
# Perkiraan sisi terpanjang objek sebenarnya (meter) per id kelas. garbage_pile (0) tidak dipakai.
TYPICAL_SIZE_M = {1: 0.20,   # plastic (botol/kantong/gelas)
                  2: 0.12,   # organic
                  3: 0.25,   # paper_cardboard
                  4: 0.15,   # metal_glass (kaleng/botol)
                  5: 0.10}   # hazardous
PRESET_SCENE_WIDTH_M = {"Dekat (±1 m)": 1.0, "Sedang (±3 m)": 3.0, "Jauh (±8 m)": 8.0}
MIN_ITEMS_FOR_AUTO_SCALE = 3     # minimal objek (non-pile) agar skala otomatis dipercaya
MIN_REF_SHARPNESS = 1.0          # di bawah ini seluruh foto dianggap lembut -> blur gate dilewati


# ---------------------------------------------------------------- 1. BLUR GATE
def sharpness_map(img_rgb, work=800):
    """Peta ketajaman lokal (rata-rata |Laplacian| jendela 15x15) pada skala kerja tetap."""
    gray = cv2.cvtColor(img_rgb, cv2.COLOR_RGB2GRAY)
    h, w = gray.shape
    s = min(1.0, work / max(h, w))
    if s < 1.0:
        gray = cv2.resize(gray, None, fx=s, fy=s, interpolation=cv2.INTER_AREA)
    gray = cv2.GaussianBlur(gray, (3, 3), 0)
    lap = np.abs(cv2.Laplacian(gray, cv2.CV_32F, ksize=3))
    return cv2.blur(lap, (15, 15))


def box_sharpness(smap, xyxy, W, H):
    """Ketajaman relatif tiap kotak = persentil-75 peta ketajaman di 70% bagian tengah kotak
    dibagi persentil-90 seluruh foto (area paling fokus). Mengembalikan (rasio, ref)."""
    sh, sw = smap.shape
    ref = float(np.percentile(smap, 90))
    ratios = []
    for x1, y1, x2, y2 in np.asarray(xyxy, float).reshape(-1, 4):
        cx, cy, bw, bh = (x1 + x2) / 2, (y1 + y2) / 2, (x2 - x1) * 0.7, (y2 - y1) * 0.7
        a, b = int(max(0, (cx - bw / 2) / W * sw)), int(max(0, (cy - bh / 2) / H * sh))
        c, d = int(min(sw, np.ceil((cx + bw / 2) / W * sw))), int(min(sh, np.ceil((cy + bh / 2) / H * sh)))
        roi = smap[b:max(d, b + 1), a:max(c, a + 1)]
        ratios.append(float(np.percentile(roi, 75)) / (ref + 1e-6))
    return np.array(ratios), ref


# ---------------------------------------------------------------- 2. SKALA
def estimate_scene_width_m(xyxy, cls, W, H, calib=1.0, edge=0.01):
    """Perkirakan lebar adegan (meter) dari ukuran objek non-pile yang tidak terpotong tepi foto.
    Mengembalikan (lebar_m atau None, jumlah_objek_dipakai)."""
    vals = []
    for (x1, y1, x2, y2), c in zip(np.asarray(xyxy, float).reshape(-1, 4), np.asarray(cls).astype(int)):
        if c not in TYPICAL_SIZE_M:
            continue
        if x1 <= edge * W or y1 <= edge * H or x2 >= (1 - edge) * W or y2 >= (1 - edge) * H:
            continue
        side = max(x2 - x1, y2 - y1)
        if side < 8:
            continue
        vals.append(TYPICAL_SIZE_M[c] * W / side)
    if len(vals) < MIN_ITEMS_FOR_AUTO_SCALE:
        return None, len(vals)
    w = float(np.exp(np.median(np.log(vals)))) * calib
    return float(np.clip(w, 0.3, 30.0)), len(vals)


# ---------------------------------------------------------------- 3. MASK SAMPAH
def garbage_mask(img_rgb, xyxy, cls, work=480, iters=4, min_bg=0.03, min_keep=0.10):
    """Pisahkan piksel sampah sebenarnya dari area bersih di dalam kotak (GrabCut).
    Latar contoh = piksel di luar semua kotak. Jika tidak ada latar (foto penuh sampah),
    kotak dipakai apa adanya. Kotak yang hasil segmentasinya runtuh (<min_keep) dikembalikan
    ke kotak penuh.

    Return dict: mask (bool, skala kerja), pile_mask, coverage, pile_coverage,
                 box_coverage (cara lama), note, shape (h, w skala kerja)."""
    H, W = img_rgb.shape[:2]
    xyxy = np.asarray(xyxy, float).reshape(-1, 4)
    cls = np.asarray(cls).astype(int).reshape(-1)
    s = min(1.0, work / max(H, W))
    sw, sh = max(1, int(round(W * s))), max(1, int(round(H * s)))
    empty = np.zeros((sh, sw), bool)
    if len(xyxy) == 0:
        return dict(mask=empty, pile_mask=empty, coverage=0.0, pile_coverage=0.0,
                    box_coverage=0.0, note="Tidak ada deteksi.", shape=(sh, sw))

    boxes = np.zeros((sh, sw), np.uint8)
    pile_boxes = np.zeros((sh, sw), np.uint8)
    boxes_idx = []
    for (x1, y1, x2, y2), c in zip(xyxy, cls):
        a, b = int(max(0, np.floor(x1 * s))), int(max(0, np.floor(y1 * s)))
        c2, d = int(min(sw, np.ceil(x2 * s))), int(min(sh, np.ceil(y2 * s)))
        if c2 <= a or d <= b:
            continue
        boxes[b:d, a:c2] = 1
        if c == 0:
            pile_boxes[b:d, a:c2] = 1
        boxes_idx.append((a, b, c2, d))
    box_cov = float(boxes.mean())

    k = max(3, int(0.03 * max(sw, sh)))
    margin = cv2.dilate(boxes, np.ones((k, k), np.uint8))
    if (margin == 0).mean() < min_bg:
        m = boxes.astype(bool)
        return dict(mask=m, pile_mask=m & pile_boxes.astype(bool), coverage=float(m.mean()),
                    pile_coverage=float((m & pile_boxes.astype(bool)).mean()), box_coverage=box_cov,
                    note="Tidak ada area latar untuk dipisahkan; luas = luas kotak.", shape=(sh, sw))

    small = cv2.cvtColor(cv2.resize(img_rgb, (sw, sh), interpolation=cv2.INTER_AREA), cv2.COLOR_RGB2BGR)
    gc = np.full((sh, sw), cv2.GC_BGD, np.uint8)
    gc[margin == 1] = cv2.GC_PR_BGD
    gc[boxes == 1] = cv2.GC_PR_FGD
    try:
        bgd, fgd = np.zeros((1, 65)), np.zeros((1, 65))
        cv2.setRNGSeed(12345)  # hasil harus identik untuk foto yang sama
        cv2.grabCut(small, gc, None, bgd, fgd, iters, cv2.GC_INIT_WITH_MASK)
        fg = ((gc == cv2.GC_FGD) | (gc == cv2.GC_PR_FGD)) & (boxes == 1)
    except cv2.error:
        m = boxes.astype(bool)
        return dict(mask=m, pile_mask=m & pile_boxes.astype(bool), coverage=float(m.mean()),
                    pile_coverage=float((m & pile_boxes.astype(bool)).mean()), box_coverage=box_cov,
                    note="Segmentasi gagal; luas = luas kotak.", shape=(sh, sw))

    fg = cv2.morphologyEx(fg.astype(np.uint8), cv2.MORPH_OPEN, np.ones((3, 3), np.uint8))
    fg = cv2.morphologyEx(fg, cv2.MORPH_CLOSE, np.ones((5, 5), np.uint8)).astype(bool) & (boxes == 1)

    reverted = 0
    for a, b, c2, d in boxes_idx:  # kotak yang segmentasinya runtuh -> kembali ke kotak
        if fg[b:d, a:c2].mean() < min_keep:
            fg[b:d, a:c2] = True
            reverted += 1
    pile_fg = fg & pile_boxes.astype(bool)
    note = "Luas dihitung dari piksel sampah (GrabCut)."
    if reverted:
        note += f" {reverted} kotak dipakai utuh karena segmentasi tidak meyakinkan."
    return dict(mask=fg, pile_mask=pile_fg, coverage=float(fg.mean()), pile_coverage=float(pile_fg.mean()),
                box_coverage=box_cov, note=note, shape=(sh, sw))


def boxes_only_mask(xyxy, cls, W, H, work=480):
    """Mode tanpa GrabCut: luas gabungan kotak (kompatibel dengan cara lama)."""
    xyxy = np.asarray(xyxy, float).reshape(-1, 4)
    cls = np.asarray(cls).astype(int).reshape(-1)
    s = min(1.0, work / max(H, W))
    sw, sh = max(1, int(round(W * s))), max(1, int(round(H * s)))
    m, p = np.zeros((sh, sw), bool), np.zeros((sh, sw), bool)
    for (x1, y1, x2, y2), c in zip(xyxy, cls):
        a, b, c2, d = int(x1 * s), int(y1 * s), int(np.ceil(x2 * s)), int(np.ceil(y2 * s))
        m[b:d, a:c2] = True
        if c == 0:
            p[b:d, a:c2] = True
    return dict(mask=m, pile_mask=p, coverage=float(m.mean()), pile_coverage=float(p.mean()),
                box_coverage=float(m.mean()), note="Luas = luas kotak (GrabCut dimatikan).", shape=(sh, sw))
