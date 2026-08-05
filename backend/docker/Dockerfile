# Dockerfile for Smart Receipt Analysis Backend

FROM python:3.11-slim

# Install system dependencies (including Tesseract for OCR)
RUN apt-get update && apt-get install -y \
    build-essential \
    tesseract-ocr \
    libtesseract-dev \
    poppler-utils \
    libglib2.0-0 \
    libsm6 \
    libxrender1 \
    libxext6 \
    gcc \
    && rm -rf /var/lib/apt/lists/*

WORKDIR /app

# ── Layer 1: lightweight / pure-Python packages (fast, always cached) ────────
COPY requirements-base.txt .
RUN pip install --no-cache-dir --timeout=300 -r requirements-base.txt

# ── Layer 2: numpy + opencv (medium, ~80 MB total) ────────────────────────────
RUN pip install --no-cache-dir --timeout=300 \
    "numpy<2.0.0" \
    "opencv-python==4.6.0.66"

# ── Layer 3: paddlepaddle (~195 MB) ───────────────────────────────────────────
RUN pip install --no-cache-dir --timeout=600 \
    paddlepaddle

# ── Layer 4: torch CPU-only (~198 MB — much smaller than the GPU wheel) ───────
RUN pip install --no-cache-dir --timeout=600 \
    torch torchvision \
    --index-url https://download.pytorch.org/whl/cpu

# ── Layer 5: transformers + paddleocr ────────────────────────────────────────
RUN pip install --no-cache-dir --timeout=300 \
    "transformers==4.38.2" \
    "paddleocr==2.7.3"

# ── Copy application ──────────────────────────────────────────────────────────
COPY . .

RUN mkdir -p logs uploads models

EXPOSE 8000

HEALTHCHECK --interval=30s --timeout=10s --start-period=60s --retries=5 \
    CMD python -c "import requests; requests.get('http://localhost:8000/health')"

CMD ["uvicorn", "app.main:app", "--host", "0.0.0.0", "--port", "8000"]

