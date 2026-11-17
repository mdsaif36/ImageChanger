
# Build React frontend
FROM node:20-alpine AS frontend-build

WORKDIR /app/frontend

COPY frontend/package*.json ./
RUN npm install

COPY frontend/ ./
RUN npm run build


# Run Flask backend and serve frontend
FROM python:3.11-slim

WORKDIR /app

RUN apt-get update && apt-get install -y --no-install-recommends \
    libgl1 \
    libglib2.0-0 \
    ca-certificates \
    && rm -rf /var/lib/apt/lists/*

COPY requirements.txt ./

RUN python -m pip install --no-cache-dir -r requirements.txt

COPY app.py ./
COPY models/ ./models/

# Download actual pretrained AI model
RUN python -c "import urllib.request; urllib.request.urlretrieve('https://huggingface.co/spaces/BilalSardar/Black-N-White-To-Color/resolve/main/colorization_release_v2.caffemodel', 'models/colorization_release_v2.caffemodel')"

# Verify downloaded model
RUN python -c "import hashlib; from pathlib import Path; p=Path('models/colorization_release_v2.caffemodel'); h=hashlib.sha256(p.read_bytes()).hexdigest(); assert p.stat().st_size > 100_000_000 and h == 'f5af1e602646328c792e1094f9876fe9cd4c09ac46fa886e5708a1abc89137b1', 'Model download failed or checksum mismatch'; print('AI model verified successfully')"

COPY --from=frontend-build /app/frontend/dist ./frontend/dist

ENV PYTHONUNBUFFERED=1

CMD ["sh", "-c", "python -m gunicorn --bind 0.0.0.0:${PORT:-8080} --workers 1 --timeout 300 app:app"]
