
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
    && rm -rf /var/lib/apt/lists/*

COPY requirements.txt ./

RUN python -m pip install --no-cache-dir -r requirements.txt

COPY app.py ./
COPY models/ ./models/

# Verify actual AI model binary is present
RUN python -c "from pathlib import Path; p=Path('models/colorization_release_v2.caffemodel'); assert p.stat().st_size > 100_000_000, 'Model file is missing or is an LFS pointer'"

COPY --from=frontend-build /app/frontend/dist ./frontend/dist

ENV PYTHONUNBUFFERED=1

CMD ["sh", "-c", "python -m gunicorn --bind 0.0.0.0:${PORT:-8080} --workers 1 --timeout 300 app:app"]
