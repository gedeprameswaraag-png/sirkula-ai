"""SirkulaAI Vision API - dipanggil dari backend Express.

Jalankan:  uvicorn api:app --host 0.0.0.0 --port 8000
POST /analyze  (multipart: foto=<file>, jarak=dekat|sedang|jauh (opsional))
"""
import cv2
import numpy as np
from fastapi import FastAPI, File, Form, HTTPException, UploadFile

from sirkula_pipeline import analyze, get_session

MAX_BYTES = 12 * 1024 * 1024
app = FastAPI(title="SirkulaAI Vision API")
get_session()  # muat model sekali saat start


@app.get("/health")
def health():
    return {"ok": True}


@app.post("/analyze")
def analyze_endpoint(foto: UploadFile = File(...), jarak: str | None = Form(None)):
    data = foto.file.read(MAX_BYTES + 1)
    if len(data) > MAX_BYTES:
        raise HTTPException(413, "Ukuran foto maksimal 12 MB.")
    bgr = cv2.imdecode(np.frombuffer(data, np.uint8), cv2.IMREAD_COLOR)  # EXIF orientation diterapkan
    if bgr is None:
        raise HTTPException(400, "File bukan gambar yang valid.")
    return analyze(cv2.cvtColor(bgr, cv2.COLOR_BGR2RGB), scale_mode=jarak)
