"""SirkulaAI - antarmuka uji (Gradio) memakai sirkula_pipeline.

Jalankan:  pip install -r requirements.txt  &&  python app.py
Slider di sini hanya MENIMPA konfigurasi sementara; nilai tetap ada di sirkula_config.json.
"""
import copy

import cv2
import numpy as np
import gradio as gr

from sirkula_config import load_config
from sirkula_pipeline import analyze_full, NAMES
from sirkula_refine import PRESET_SCENE_WIDTH_M

CLASS_COLORS = [(255, 0, 0), (0, 120, 255), (0, 170, 0), (200, 140, 0), (150, 0, 200), (230, 0, 120)]
LEVEL_COLOR = {"ringan": (0, 200, 0), "sedang": (255, 165, 0), "berat": (255, 0, 0), None: (120, 120, 120)}
LEVEL_UI = {"ringan": ("🟢", "RINGAN"), "sedang": ("🟠", "SEDANG"), "berat": ("🔴", "BERAT"), None: ("⚪", "-")}
STATUS_UI = {"valid_otomatis": "✅ VALID OTOMATIS", "tinjau_admin": "🟡 PERLU TINJAUAN ADMIN",
             "foto_ulang": "🔴 FOTO ULANG"}
SCALE_CHOICES = ["Otomatis (dari ukuran objek)"] + list(PRESET_SCENE_WIDTH_M.keys())


def to_markdown(rep):
    icon, title = LEVEL_UI[rep["level"]]
    lines = [f"## {STATUS_UI[rep['status']]}", f"### {icon} Tingkat sampah: {title}", ""]
    lines += [f"- ⚠️ {a}" for a in rep["alasan"]]
    if rep["status"] != "foto_ulang":
        lines += [f"- Luas sampah ≈ **{rep['luas_sampah_m2']:.2f} m²** (tumpukan: {rep['luas_tumpukan_m2']:.2f} m²)",
                  f"- Jumlah objek: **{rep['jumlah_objek']}**, area foto tertutup sampah: **{rep['persen_foto_tertutup']}%**",
                  f"- Skala: lebar foto ≈ {rep['lebar_adegan_m']} m ({rep['sumber_skala']})",
                  f"- Dibuang karena buram: {rep['dibuang_buram']} objek"]
    lines.append(f"\n_Konfigurasi v{rep['versi_config']} · ketajaman {rep['kualitas']['ketajaman']} · "
                 f"kecerahan {rep['kualitas']['kecerahan']}_")
    return "\n".join(lines)


def detect(img_rgb, conf_item, conf_pile, iou_thr, use_blur, blur_min, use_gc, scale_mode, calib,
           show_rejected, area_sedang, area_berat, pile_berat):
    if img_rgb is None:
        return None, [], ""
    cfg = copy.deepcopy(load_config())
    cfg.update(conf_item=conf_item, conf_pile=conf_pile, iou=iou_thr, use_blur=use_blur, blur_min=blur_min,
               use_grabcut=use_gc, calib=calib, area_sedang=area_sedang, area_berat=area_berat,
               pile_berat=pile_berat)
    mode = None if scale_mode == SCALE_CHOICES[0] else scale_mode
    rep, d = analyze_full(img_rgb, cfg, mode)

    vis, (H, W) = d["img"].copy(), d["img"].shape[:2]
    cov = d["cov"]
    col_lv = LEVEL_COLOR[rep["level"]]
    if cov["mask"].any():
        m = cv2.resize(cov["mask"].astype(np.uint8), (W, H), interpolation=cv2.INTER_NEAREST).astype(bool)
        vis[m] = (0.65 * vis[m] + 0.35 * np.array(col_lv, np.float32)).astype(np.uint8)
        cnts, _ = cv2.findContours(m.astype(np.uint8), cv2.RETR_EXTERNAL, cv2.CHAIN_APPROX_SIMPLE)
        cv2.drawContours(vis, cnts, -1, col_lv, 2)
    rows = []
    for (a, b, c, dd), k, p, s, o in zip(d["xyxy"], d["cls"], d["conf"], d["sharp"], rep["objek"]):
        col, p1, p2 = CLASS_COLORS[k], (int(a), int(b)), (int(c), int(dd))
        cv2.rectangle(vis, p1, p2, col, 2)
        cv2.putText(vis, f"{NAMES[k]} {p:.2f}", (p1[0], max(p1[1] - 6, 14)), cv2.FONT_HERSHEY_SIMPLEX, 0.6, col, 2)
        rows.append([NAMES[k], round(float(p), 3), int(c - a), int(dd - b), round(float(s), 2),
                     o["perkiraan_cm"] if o["perkiraan_cm"] is not None else "-"])
    if show_rejected:
        for (a, b, c, dd), k, s, ok in zip(d["xyxy0"], d["cls0"], d["ratios"], d["blur_ok"]):
            if not ok:
                p1, p2 = (int(a), int(b)), (int(c), int(dd))
                cv2.rectangle(vis, p1, p2, (140, 140, 140), 1)
                cv2.putText(vis, f"BURAM {NAMES[k]} {s:.2f}", (p1[0], max(p1[1] - 6, 14)),
                            cv2.FONT_HERSHEY_SIMPLEX, 0.5, (140, 140, 140), 1)
    vis = cv2.copyMakeBorder(vis, 12, 12, 12, 12, cv2.BORDER_CONSTANT, value=col_lv)
    return vis, rows, to_markdown(rep)


with gr.Blocks(title="SirkulaAI - Tes Model Sampah") as demo:
    gr.Markdown("# SirkulaAI - Deteksi Sampah\nUpload foto → status validasi, luas sampah **nyata (m²)**, "
                "dan **tingkat keparahan**.")
    with gr.Row():
        with gr.Column():
            inp = gr.Image(type="numpy", label="Foto")
            with gr.Accordion("Deteksi & filter", open=True):
                conf_item = gr.Slider(0.05, 0.95, 0.35, step=0.05, label="Confidence minimum - objek")
                conf_pile = gr.Slider(0.05, 0.95, 0.45, step=0.05, label="Confidence minimum - garbage_pile")
                iou = gr.Slider(0.1, 0.9, 0.5, step=0.05, label="IoU NMS (lintas kelas)")
                use_blur = gr.Checkbox(True, label="Buang objek buram")
                blur_min = gr.Slider(0.05, 1.0, 0.30, step=0.05, label="Ketajaman minimum relatif")
                show_rej = gr.Checkbox(True, label="Tampilkan kotak yang dibuang (abu-abu)")
            with gr.Accordion("Skala & luas", open=True):
                use_gc = gr.Checkbox(True, label="Hitung luas dari piksel sampah (GrabCut)")
                scale_mode = gr.Dropdown(SCALE_CHOICES, value=SCALE_CHOICES[0], label="Skala foto / jarak pengambilan")
                calib = gr.Slider(0.5, 2.0, 1.0, step=0.05, label="Faktor kalibrasi skala (×)")
            with gr.Accordion("Ambang keparahan (m²)", open=False):
                area_sedang = gr.Slider(0.1, 10, 0.5, step=0.1, label="SEDANG jika luas ≥ (m²)")
                area_berat = gr.Slider(0.5, 30, 3.0, step=0.5, label="BERAT jika luas ≥ (m²)")
                pile_berat = gr.Slider(0.5, 30, 2.0, step=0.5, label="BERAT jika luas garbage_pile ≥ (m²)")
            btn = gr.Button("Deteksi", variant="primary")
        with gr.Column():
            sev_md = gr.Markdown()
            outimg = gr.Image(label="Hasil (area berwarna = piksel sampah)")
            table = gr.Dataframe(headers=["kelas", "conf", "lebar_px", "tinggi_px", "ketajaman_rel", "perkiraan_cm"],
                                 label="Detail deteksi")
    btn.click(detect, [inp, conf_item, conf_pile, iou, use_blur, blur_min, use_gc, scale_mode, calib, show_rej,
                       area_sedang, area_berat, pile_berat], [outimg, table, sev_md])

if __name__ == "__main__":
    demo.launch()
