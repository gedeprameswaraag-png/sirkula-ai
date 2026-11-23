"""
SirkulaAI - pipeline analisis foto laporan (satu pintu untuk app.py, api.py, evaluate.py).

analyze(img_rgb)  ->  laporan JSON-able dengan status:
  valid_otomatis : foto layak & hasil stabil, boleh langsung diproses
  tinjau_admin   : hasil meragukan (keyakinan rendah / skala tidak pasti / tidak ada deteksi / banyak buram)
  foto_ulang     : foto tidak layak dinilai (terlalu kecil/gelap/terang/buram)
"""
import os
import threading

import cv2
import numpy as np
import onnxruntime as ort

from sirkula_config import load_config
from sirkula_severity import assess_metric
from sirkula_refine import (sharpness_map, box_sharpness, estimate_scene_width_m, garbage_mask,
                            boxes_only_mask, PRESET_SCENE_WIDTH_M)

HERE = os.path.dirname(os.path.abspath(__file__))
MODEL_PATH = os.path.join(HERE, "best.onnx")
NAMES = ["garbage_pile", "plastic", "organic", "paper_cardboard", "metal_glass", "hazardous"]
IMGSZ = 640
JARAK_ALIAS = {"dekat": "Dekat (±1 m)", "sedang": "Sedang (±3 m)", "jauh": "Jauh (±8 m)"}

_sess, _input = None, None
_lock = threading.Lock()  # satu analisis pada satu waktu -> hasil deterministik


def get_session():
    global _sess, _input
    if _sess is None:
        _sess = ort.InferenceSession(MODEL_PATH, providers=["CPUExecutionProvider"])
        _input = _sess.get_inputs()[0].name
    return _sess, _input


def letterbox(img, size=IMGSZ):
    h, w = img.shape[:2]
    r = size / max(h, w)
    nw, nh = int(round(w * r)), int(round(h * r))
    resized = cv2.resize(img, (nw, nh), interpolation=cv2.INTER_LINEAR)
    canvas = np.full((size, size, 3), 114, np.uint8)
    dx, dy = (size - nw) // 2, (size - nh) // 2
    canvas[dy:dy + nh, dx:dx + nw] = resized
    return canvas, r, dx, dy


def run_model(img_rgb, cfg):
    """Inferensi + confidence per kelas + NMS lintas kelas + buang kotak terlalu kecil."""
    sess, inp = get_session()
    H, W = img_rgb.shape[:2]
    lb, r, dx, dy = letterbox(img_rgb)
    x = lb.astype(np.float32).transpose(2, 0, 1)[None] / 255.0
    out = sess.run(None, {inp: x})[0][0].T
    boxes_xywh, scores = out[:, :4], out[:, 4:]
    cls, conf = scores.argmax(1), scores.max(1)
    keep = conf >= np.where(cls == 0, cfg["conf_pile"], cfg["conf_item"])
    boxes_xywh, cls, conf = boxes_xywh[keep], cls[keep], conf[keep]
    if len(conf) == 0:
        return np.zeros((0, 4)), np.zeros(0, int), np.zeros(0)
    cx, cy, bw, bh = boxes_xywh.T
    x1 = np.clip((cx - bw / 2 - dx) / r, 0, W)
    y1 = np.clip((cy - bh / 2 - dy) / r, 0, H)
    x2 = np.clip((cx + bw / 2 - dx) / r, 0, W)
    y2 = np.clip((cy + bh / 2 - dy) / r, 0, H)
    nb = [[float(a), float(b), float(c - a), float(d - b)] for a, b, c, d in zip(x1, y1, x2, y2)]
    idx = [int(i) for i in np.array(cv2.dnn.NMSBoxes(nb, conf.tolist(), 0.0, cfg["iou"])).flatten()]
    xyxy = np.stack([x1[idx], y1[idx], x2[idx], y2[idx]], axis=1)
    cls, conf = cls[idx], conf[idx]
    ok = (xyxy[:, 2] - xyxy[:, 0]) * (xyxy[:, 3] - xyxy[:, 1]) / (W * H) >= cfg["min_box_pct"] / 100
    return xyxy[ok], cls[ok], conf[ok]


def quality_issue(img_rgb, ref_sharp, cfg):
    g, (H, W) = cfg["gate"], img_rgb.shape[:2]
    if min(H, W) < g["min_short_side"]:
        return f"Resolusi foto terlalu kecil ({min(H, W)} px)."
    bright = float(cv2.cvtColor(img_rgb, cv2.COLOR_RGB2GRAY).mean())
    if bright < g["brightness_min"]:
        return "Foto terlalu gelap."
    if bright > g["brightness_max"]:
        return "Foto terlalu terang."
    if ref_sharp < g["min_global_sharpness"]:
        return "Foto terlalu buram atau minim detail; ambil ulang dengan fokus yang jelas."
    return None


def decide(f, cfg):
    """Fungsi murni: fitur -> level + status. Dipakai juga oleh evaluate.py untuk kalibrasi."""
    g = cfg["gate"]
    if f["quality_issue"]:
        return {"level": None, "status": "foto_ulang", "reasons": [f["quality_issue"]],
                "area_m2": 0.0, "pile_area_m2": 0.0}
    sw, sh = f["scene_w"], f["scene_w"] * f["aspect"]

    def lv(m):
        return assess_metric(f["coverage"], f["pile_coverage"], f["count"], sw * m, sh * m,
                             area_berat=cfg["area_berat"], area_sedang=cfg["area_sedang"],
                             pile_area_berat=cfg["pile_berat"], count_berat=cfg["count_berat"],
                             count_area_berat=cfg["count_area_berat"], count_sedang=cfg["count_sedang"])

    base = lv(1.0)
    lo, hi = g["scale_spread_auto"] if f["auto_scale"] else g["scale_spread_manual"]
    reasons, status = [], "valid_otomatis"
    if f["count"] == 0:
        status = "tinjau_admin"
        reasons.append("Foto layak tetapi tidak ada sampah terdeteksi (mungkin sudah bersih atau tidak terdeteksi).")
    else:
        if lv(lo)["level"] != base["level"] or lv(hi)["level"] != base["level"]:
            status = "tinjau_admin"
            reasons.append("Tingkat bergantung pada perkiraan skala (jarak foto tidak pasti).")
        if f["conf_max"] < g["conf_review"]:
            status = "tinjau_admin"
            reasons.append("Keyakinan model rendah.")
        tot = f["n_blur"] + f["count"]
        if f["n_blur"] and f["n_blur"] / tot >= g["max_blur_drop_ratio"]:
            status = "tinjau_admin"
            reasons.append("Banyak objek dibuang karena buram.")
    return {"level": base["level"], "status": status, "reasons": reasons,
            "area_m2": base["area_m2"], "pile_area_m2": base["pile_area_m2"]}


def analyze_full(img_rgb, cfg=None, scale_mode=None):
    """Return (laporan, debug). scale_mode: None/'otomatis' | 'dekat' | 'sedang' | 'jauh' | label preset."""
    cfg = cfg or load_config()
    with _lock:
        H0, W0 = img_rgb.shape[:2]
        s = min(1.0, cfg["max_side"] / max(H0, W0))
        img = cv2.resize(img_rgb, None, fx=s, fy=s, interpolation=cv2.INTER_AREA) if s < 1 else img_rgb
        H, W = img.shape[:2]
        smap = sharpness_map(img)
        ref = float(np.percentile(smap, 90))
        bright = float(cv2.cvtColor(img, cv2.COLOR_RGB2GRAY).mean())
        issue = quality_issue(img, ref, cfg)

        e0 = np.zeros((0, 4))
        xyxy0, cls0, conf0, ratios, blur_ok = e0, np.zeros(0, int), np.zeros(0), np.zeros(0), np.zeros(0, bool)
        xyxy, cls, conf, sharp = e0, np.zeros(0, int), np.zeros(0), np.zeros(0)
        cov = boxes_only_mask(e0, cls, W, H)
        scene_w, src, auto = PRESET_SCENE_WIDTH_M["Sedang (±3 m)"], "asumsi Sedang ±3 m", False
        if not issue:
            xyxy0, cls0, conf0 = run_model(img, cfg)
            blur_ok = np.ones(len(cls0), bool)
            ratios = np.ones(len(cls0))
            if len(cls0):
                ratios, _ = box_sharpness(smap, xyxy0, W, H)
                if cfg["use_blur"]:
                    blur_ok = ratios >= np.where(cls0 == 0, cfg["blur_min"] * 0.6, cfg["blur_min"])
            xyxy, cls, conf, sharp = xyxy0[blur_ok], cls0[blur_ok], conf0[blur_ok], ratios[blur_ok]

            mode = (scale_mode or "otomatis").strip()
            mode = JARAK_ALIAS.get(mode.lower(), mode)
            if mode in PRESET_SCENE_WIDTH_M:
                scene_w, src = PRESET_SCENE_WIDTH_M[mode] * cfg["calib"], f"pilihan jarak: {mode}"
            else:
                w_est, n_used = estimate_scene_width_m(xyxy, cls, W, H, calib=cfg["calib"])
                if w_est is not None:
                    scene_w, src, auto = w_est, f"otomatis dari {n_used} objek", True
                else:
                    src = "otomatis gagal (objek <3), dipakai asumsi Sedang ±3 m"
            cov = garbage_mask(img, xyxy, cls) if cfg["use_grabcut"] else boxes_only_mask(xyxy, cls, W, H)

        feat = dict(quality_issue=issue, coverage=cov["coverage"], pile_coverage=cov["pile_coverage"],
                    count=int(len(cls)), scene_w=scene_w, aspect=H / W, auto_scale=auto,
                    conf_max=float(conf.max()) if len(conf) else 0.0, n_blur=int((~blur_ok).sum()))
        d = decide(feat, cfg)
        objek = [{"kelas": NAMES[k], "confidence": round(float(p), 3),
                  "bbox_norm": [round(float(a) / W, 4), round(float(b) / H, 4), round(float(c) / W, 4), round(float(dd) / H, 4)],
                  "perkiraan_cm": None if k == 0 else int(max(c - a, dd - b) / W * scene_w * 100)}
                 for (a, b, c, dd), k, p in zip(xyxy, cls, conf)]
        report = {"versi_config": cfg["version"], "status": d["status"], "alasan": d["reasons"],
                  "level": d["level"], "luas_sampah_m2": d["area_m2"], "luas_tumpukan_m2": d["pile_area_m2"],
                  "jumlah_objek": feat["count"], "persen_foto_tertutup": round(cov["coverage"] * 100, 1),
                  "lebar_adegan_m": round(scene_w, 2), "sumber_skala": src,
                  "dibuang_buram": feat["n_blur"],
                  "kualitas": {"ketajaman": round(ref, 2), "kecerahan": round(bright, 1)}, "objek": objek}
        dbg = dict(feat=feat, decision=d, img=img, xyxy=xyxy, cls=cls, conf=conf, sharp=sharp,
                   xyxy0=xyxy0, cls0=cls0, conf0=conf0, ratios=ratios, blur_ok=blur_ok, cov=cov,
                   scene_w=scene_w, src=src)
        return report, dbg


def analyze(img_rgb, cfg=None, scale_mode=None):
    return analyze_full(img_rgb, cfg, scale_mode)[0]
