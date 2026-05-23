# Dockerfile for Smart Receipt Analysis Backend

FROM python:3.11-slim

# Install system dependencies (including Tesseract for OCR)
RUN apt-get update && apt-get install -y \
    build-essential \
    tesseract-ocr \
    libtesseract-dev \
    poppler-utils \
    gcc \
    && rm -rf /var/lib/apt/lists/*

# Set working directory
WORKDIR /app

# Copy requirements
COPY requirements.txt .

# Install Python dependencies
RUN pip install --no-cache-dir -r requirements.txt

# Copy application
COPY . .

# Create necessary directories
RUN mkdir -p logs uploads models

# Expose port
EXPOSE 8000

# Health check
HEALTHCHECK --interval=30s --timeout=10s --start-period=5s --retries=3 \
    CMD python -c "import requests; requests.get('http://localhost:8000/health')"

# Run application
CMD ["uvicorn", "app.main:app", "--host", "0.0.0.0", "--port", "8000"]
