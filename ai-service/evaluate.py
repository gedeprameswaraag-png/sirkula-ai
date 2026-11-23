"""
SirkulaAI - evaluasi & kalibrasi dengan foto asli berlabel.

Struktur dataset (nama folder = label yang disepakati manusia):
    dataset/
        bersih/   ringan/   sedang/   berat/        (jpg/png/webp)

Jalankan:
    python evaluate.py dataset
Keluaran:
    hasil_evaluasi.csv                  hasil per foto
    sirkula_config.suggested.json       ambang hasil kalibrasi (ganti nama jadi sirkula_config.json untuk dipakai)
Minimal ±15 foto per kelas agar angka bermakna; makin banyak makin baik.
"""
import argparse
import copy
import csv
import glob
import itertools
import json
import os
import random
from collections import Counter

import cv2
import numpy as np

from sirkula_config import load_config
from sirkula_pipeline import analyze_full, decide

LEVELS = ["ringan", "sedang", "berat"]
FOLDERS = {"bersih": "ringan", "ringan": "ringan", "sedang": "sedang", "berat": "berat"}
EXT = ("jpg", "jpeg", "png", "webp", "bmp")


def load_rgb(path):
    bgr = cv2.imdecode(np.fromfile(path, np.uint8), cv2.IMREAD_COLOR)  # aman untuk path Windows/unicode
    return None if bgr is None else cv2.cvtColor(bgr, cv2.COLOR_BGR2RGB)


def collect(root):
    items = []
    for folder, expected in FOLDERS.items():
        for e in EXT:
            for p in glob.glob(os.path.join(root, folder, f"*.{e}")) + glob.glob(os.path.join(root, folder, f"*.{e.upper()}")):
                items.append((p, folder, expected))
    return sorted(set(items))


def score(rows, cfg):
    conf = np.zeros((3, 3), int)
    st, auto_n, auto_ok, serious = Counter(), 0, 0, 0
    for r in rows:
        d = decide(r["feat"], cfg)
        st[d["status"]] += 1
        if d["level"] is None:
            continue
        i, j = LEVELS.index(r["expected"]), LEVELS.index(d["level"])
        conf[i, j] += 1
        if d["status"] == "valid_otomatis":
            auto_n += 1
            auto_ok += int(i == j)
        serious += int(abs(i - j) == 2)
    rec = [conf[i, i] / conf[i].sum() for i in range(3) if conf[i].sum()]
    n = conf.sum()
    return dict(conf=conf, balanced=float(np.mean(rec)) if rec else 0.0, acc=float(np.trace(conf) / n) if n else 0.0,
                auto_n=auto_n, auto_acc=auto_ok / auto_n if auto_n else 0.0, status=st, serious=int(serious))


def fit_thresholds(rows, cfg):
    best, best_key = None, None
    for sed, ber, pile in itertools.product([0.1, 0.2, 0.3, 0.5, 0.75, 1, 1.5, 2],
                                            [1, 1.5, 2, 3, 4, 6, 8, 12], [0.5, 1, 2, 3, 5, 8, 12]):
        if sed >= ber:
            continue
        c = copy.deepcopy(cfg)
        c.update(area_sedang=sed, area_berat=ber, pile_berat=pile)
        m = score(rows, c)
        key = (round(m["balanced"], 4), -m["serious"], m["auto_acc"])
        if best_key is None or key > best_key:
            best, best_key = c, key
    return best


def show(title, m):
    print(f"\n=== {title} ===")
    print(f"Akurasi: {m['acc'] * 100:.1f}% | Balanced accuracy: {m['balanced'] * 100:.1f}% | "
          f"Salah fatal (ringan<->berat): {m['serious']}")
    print(f"Status: {dict(m['status'])} | Akurasi pada yang 'valid_otomatis': {m['auto_acc'] * 100:.1f}% "
          f"(n={m['auto_n']})")
    print("Confusion matrix (baris=label, kolom=prediksi)")
    print("            " + "  ".join(f"{l:>7}" for l in LEVELS))
    for i, l in enumerate(LEVELS):
        print(f"{l:>10}  " + "  ".join(f"{v:>7}" for v in m["conf"][i]))


def main():
    ap = argparse.ArgumentParser()
    ap.add_argument("dataset")
    ap.add_argument("--test", type=float, default=0.3, help="porsi data uji (0 = tanpa pemisahan)")
    ap.add_argument("--seed", type=int, default=42)
    a = ap.parse_args()

    cfg = load_config()
    items = collect(a.dataset)
    if not items:
        raise SystemExit("Tidak ada foto. Pastikan ada folder bersih/ringan/sedang/berat di dalam dataset.")
    print(f"{len(items)} foto ditemukan:", dict(Counter(f for _, f, _ in items)))

    rows = []
    for k, (p, folder, expected) in enumerate(items, 1):
        img = load_rgb(p)
        if img is None:
            print("Lewati (tidak terbaca):", p)
            continue
        rep, dbg = analyze_full(img, cfg)
        rows.append(dict(path=p, folder=folder, expected=expected, feat=dbg["feat"], rep=rep))
        print(f"\r[{k}/{len(items)}]", end="")
    print()

    sh = np.array([r["rep"]["kualitas"]["ketajaman"] for r in rows])
    print(f"Ketajaman foto (acuan min_global_sharpness): min {sh.min():.1f} | persentil-10 {np.percentile(sh, 10):.1f} "
          f"| median {np.median(sh):.1f}")
    base = score(rows, cfg)
    show("Konfigurasi SAAT INI (semua foto)", base)
    fa = [r for r in rows if r["folder"] == "bersih" and r["feat"]["count"] > 0]
    nb = sum(r["folder"] == "bersih" for r in rows)
    if nb:
        print(f"\nFalse alarm pada foto 'bersih': {len(fa)}/{nb}")

    random.Random(a.seed).shuffle(rows)
    if a.test > 0 and len(rows) >= 30:
        cut = int(len(rows) * (1 - a.test))
        train, test = rows[:cut], rows[cut:]
        c_tr = fit_thresholds(train, cfg)
        show(f"Ambang hasil kalibrasi - DATA LATIH ({len(train)})", score(train, c_tr))
        show(f"Ambang hasil kalibrasi - DATA UJI ({len(test)})  <- angka yang jujur", score(test, c_tr))
    else:
        print("\n(Data <30 foto: pemisahan latih/uji dilewati, hasil kalibrasi bisa terlalu optimistis.)")

    final = fit_thresholds(rows, cfg)
    final["version"] = f"kalibrasi-n{len(rows)}"
    show("Ambang final (semua data)", score(rows, final))
    print("\nAmbang:", {k: final[k] for k in ("area_sedang", "area_berat", "pile_berat")})

    with open("sirkula_config.suggested.json", "w", encoding="utf-8") as f:
        json.dump(final, f, indent=2, ensure_ascii=False)
    with open("hasil_evaluasi.csv", "w", newline="", encoding="utf-8") as f:
        w = csv.writer(f)
        w.writerow(["file", "folder", "label", "prediksi", "status", "alasan", "luas_m2", "jumlah_objek", "ketajaman", "kecerahan"])
        for r in rows:
            d = decide(r["feat"], final)
            w.writerow([r["path"], r["folder"], r["expected"], d["level"], d["status"], " | ".join(d["reasons"]),
                        d["area_m2"], r["feat"]["count"], r["rep"]["kualitas"]["ketajaman"],
                        r["rep"]["kualitas"]["kecerahan"]])
    print("\nTersimpan: sirkula_config.suggested.json, hasil_evaluasi.csv")
    print("Periksa baris yang salah di CSV, lalu ganti nama file .suggested.json -> sirkula_config.json")


if __name__ == "__main__":
    main()
