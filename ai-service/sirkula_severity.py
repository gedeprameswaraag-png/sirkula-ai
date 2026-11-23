"""
SirkulaAI - penilaian tingkat keparahan sampah dari hasil deteksi YOLOv8.

Level:
  ringan -> sampah sedikit, cukup petugas/tukang angkut
  sedang -> cukup banyak, tapi masih bisa ditangani petugas
  berat  -> sampah menumpuk/mencemari area luas, perlu GOTONG ROYONG

Penilaian UTAMA kini memakai luas NYATA (m2) lewat assess_metric(), bukan persen foto,
sehingga foto dekat/jauh tidak lagi menyesatkan. assess_from_boxes() (persen foto)
dipertahankan hanya sebagai kompatibilitas.
"""
import numpy as np

# ===== Ambang batas luas nyata (m2): KALIBRASI dengan foto asli aplikasi Anda =====
AREA_BERAT_M2 = 3.0          # total area sampah >= 3 m2
AREA_SEDANG_M2 = 0.5         # >= 0.5 m2
PILE_AREA_BERAT_M2 = 2.0     # area tumpukan (garbage_pile) saja >= 2 m2
COUNT_BERAT_M = 15           # banyak objek ...
COUNT_AREA_BERAT_M2 = 1.5    # ... dan area >= 1.5 m2
COUNT_SEDANG_M = 5           # banyak objek (sedang) ...
COUNT_AREA_FLOOR_RATIO = 0.25  # ... hanya jika area >= 25% ambang sedang (cegah foto close-up)


def assess_metric(coverage, pile_coverage, count, scene_w_m, scene_h_m,
                  area_berat=AREA_BERAT_M2, area_sedang=AREA_SEDANG_M2,
                  pile_area_berat=PILE_AREA_BERAT_M2, count_berat=COUNT_BERAT_M,
                  count_area_berat=COUNT_AREA_BERAT_M2, count_sedang=COUNT_SEDANG_M):
    """coverage/pile_coverage = fraksi piksel sampah (0-1); scene_*_m = ukuran adegan (meter)."""
    scene_area = scene_w_m * scene_h_m
    area, pile_area = coverage * scene_area, pile_coverage * scene_area
    if count == 0:
        return {"level": "ringan", "area_m2": 0.0, "pile_area_m2": 0.0, "count": 0,
                "reason": "Tidak ada sampah terdeteksi."}
    if (area >= area_berat or pile_area >= pile_area_berat
            or (count >= count_berat and area >= count_area_berat)):
        level, reason = "berat", "Sampah menumpuk/menyebar luas, perlu gotong royong warga."
    elif area >= area_sedang or (count >= count_sedang and area >= COUNT_AREA_FLOOR_RATIO * area_sedang):
        level, reason = "sedang", "Sampah cukup banyak, masih bisa ditangani petugas kebersihan."
    else:
        level, reason = "ringan", "Sampah sedikit, cukup diangkut tukang sampah."
    return {"level": level, "area_m2": round(area, 2), "pile_area_m2": round(pile_area, 2),
            "count": int(count), "reason": reason}


# ===== (LEGACY) Ambang batas berbasis persen foto =====
COVERAGE_BERAT = 0.35      # >=35% area foto tertutup sampah
COVERAGE_SEDANG = 0.10     # >=10%
PILE_COVERAGE_BERAT = 0.25 # tumpukan (garbage_pile) saja sudah >=25% foto
COUNT_BERAT = 15           # banyak objek ...
COVERAGE_COUNT_BERAT = 0.20  # ... dan area >=20%
COUNT_SEDANG = 5
GARBAGE_PILE_ID = 0
GRID = 200                 # resolusi grid untuk hitung luas gabungan


def _union_coverage(boxes_xyxy, W, H):
    """Luas gabungan semua box / luas gambar (box tumpang tindih tidak dihitung ganda)."""
    if len(boxes_xyxy) == 0:
        return 0.0
    mask = np.zeros((GRID, GRID), dtype=bool)
    for x1, y1, x2, y2 in boxes_xyxy:
        a, b = int(max(0, x1) / W * GRID), int(max(0, y1) / H * GRID)
        c, d = int(np.ceil(min(W, x2) / W * GRID)), int(np.ceil(min(H, y2) / H * GRID))
        mask[b:d, a:c] = True
    return float(mask.mean())


def assess_from_boxes(xyxy, cls, W, H,
                      coverage_berat=COVERAGE_BERAT, coverage_sedang=COVERAGE_SEDANG,
                      pile_coverage_berat=PILE_COVERAGE_BERAT,
                      count_berat=COUNT_BERAT, count_sedang=COUNT_SEDANG,
                      coverage_count_berat=COVERAGE_COUNT_BERAT):
    """Versi murni numpy (tanpa ultralytics), cocok untuk onnxruntime.
    xyxy: (N,4) piksel gambar asli, cls: (N,) id kelas, W/H: ukuran gambar asli."""
    xyxy = np.asarray(xyxy, dtype=float).reshape(-1, 4)
    cls = np.asarray(cls).astype(int).reshape(-1)
    count = int(len(cls))
    if count == 0:
        return {"level": "ringan", "coverage": 0.0, "pile_coverage": 0.0,
                "count": 0, "reason": "Tidak ada sampah terdeteksi."}

    coverage = _union_coverage(xyxy, W, H)
    pile_cov = _union_coverage(xyxy[cls == GARBAGE_PILE_ID], W, H)

    if (coverage >= coverage_berat or pile_cov >= pile_coverage_berat
            or (count >= count_berat and coverage >= coverage_count_berat)):
        level = "berat"
        reason = "Sampah menumpuk/menyebar luas, perlu gotong royong warga."
    elif coverage >= coverage_sedang or count >= count_sedang:
        level = "sedang"
        reason = "Sampah cukup banyak, masih bisa ditangani petugas kebersihan."
    else:
        level = "ringan"
        reason = "Sampah sedikit, cukup diangkut tukang sampah."

    return {"level": level, "coverage": round(coverage, 3),
            "pile_coverage": round(pile_cov, 3), "count": count, "reason": reason}


def assess_severity(result, min_conf=0.25, **thresholds):
    """`result` = satu objek hasil model.predict(...)[0] dari ultralytics."""
    H, W = result.orig_shape
    b = result.boxes
    if b is None or len(b) == 0:
        return assess_from_boxes([], [], W, H)
    conf = b.conf.cpu().numpy()
    keep = conf >= min_conf
    return assess_from_boxes(b.xyxy.cpu().numpy()[keep],
                             b.cls.cpu().numpy()[keep], W, H, **thresholds)


if __name__ == "__main__":
    # Uji cepat dengan hasil deteksi palsu
    import numpy as np

    class _T:
        def __init__(s, a): s.a = a
        def cpu(s): return s
        def numpy(s): return s.a
        def __len__(s): return len(s.a)

    class _B:
        def __init__(s, rows):
            t = np.array(rows, dtype=np.float32)
            s.xyxy, s.conf, s.cls = _T(t[:, :4]), _T(t[:, 4]), _T(t[:, 5])
        def __len__(s): return len(s.cls.a)

    class _R:
        def __init__(s, rows): s.orig_shape, s.boxes = (480, 640), _B(rows)

    print(assess_severity(_R([[10, 10, 80, 80, .9, 1]])))                          # ringan
    print(assess_severity(_R([[0, 0, 200, 150, .9, 1], [250, 200, 450, 400, .8, 2]])))  # sedang
    print(assess_severity(_R([[0, 100, 640, 480, .9, 0]])))                        # berat
