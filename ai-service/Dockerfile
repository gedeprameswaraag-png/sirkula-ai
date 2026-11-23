FROM python:3.11-slim

# System deps untuk opencv & onnxruntime
RUN apt-get update && apt-get install -y --no-install-recommends \
    libgl1 \
    libglib2.0-0 \
    libsm6 \
    libxext6 \
    libxrender1 \
    && rm -rf /var/lib/apt/lists/*

WORKDIR /app

# Install Python deps dulu (layer caching)
COPY requirements.txt .
RUN pip install --no-cache-dir -r requirements.txt

# Copy kode
COPY . .

# Download model ONNX saat build (isi URL kamu, lihat langkah 3)
# Kalau model sudah ada di folder, baris ini boleh dihapus
RUN test -f best.onnx

# Render memberi PORT via env
ENV PORT=8000
EXPOSE 8000

# Ganti 'api:app' jika FastAPI object di api.py bernama lain
CMD ["sh", "-c", "uvicorn api:app --host 0.0.0.0 --port ${PORT}"]