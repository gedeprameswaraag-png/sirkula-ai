"""Konfigurasi terpusat + bernomor versi. Semua ambang ada di sini agar hasil konsisten & bisa diaudit.
Override dengan file sirkula_config.json (hasil kalibrasi dari evaluate.py) di folder yang sama."""
import copy
import json
import os

HERE = os.path.dirname(os.path.abspath(__file__))

DEFAULTS = {
    "version": "1.0.0-default",
    # deteksi & filter
    "max_side": 1600, "conf_item": 0.35, "conf_pile": 0.45, "iou": 0.5, "min_box_pct": 0.2,
    "use_blur": True, "blur_min": 0.30, "use_grabcut": True, "calib": 1.0,
    # ambang tingkat keparahan (m2)
    "area_sedang": 0.5, "area_berat": 3.0, "pile_berat": 2.0,
    "count_sedang": 5, "count_berat": 15, "count_area_berat": 1.5,
    # gerbang kualitas / keputusan
    "gate": {
        "min_short_side": 320,          # px, di bawah ini -> foto ulang
        "brightness_min": 35, "brightness_max": 225,
        "min_global_sharpness": 3.0,    # seluruh foto terlalu buram -> foto ulang (KALIBRASI: lihat kolom ketajaman di hasil_evaluasi.csv)
        "conf_review": 0.50,            # keyakinan tertinggi < ini -> tinjau admin
        "max_blur_drop_ratio": 0.5,     # >=50% deteksi dibuang karena buram -> tinjau admin
        "scale_spread_auto": [0.75, 1.33],    # ketidakpastian lebar adegan (skala otomatis)
        "scale_spread_manual": [0.5, 2.0],    # ketidakpastian jika skala dari pilihan jarak/asumsi
    },
}


def _merge(base, over):
    for k, v in over.items():
        if isinstance(v, dict) and isinstance(base.get(k), dict):
            _merge(base[k], v)
        else:
            base[k] = v
    return base


def load_config(path=None):
    cfg = copy.deepcopy(DEFAULTS)
    path = path or os.path.join(HERE, "sirkula_config.json")
    if os.path.exists(path):
        with open(path, encoding="utf-8") as f:
            _merge(cfg, json.load(f))
    return cfg
