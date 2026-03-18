# ── Stage 1: Base image ───────────────────────────────
FROM python:3.11-slim

# Set working directory
WORKDIR /app

# Install system dependencies (needed for PyMuPDF)
RUN apt-get update && apt-get install -y \
    gcc \
    libgl1 \
    libglib2.0-0 \
    && rm -rf /var/lib/apt/lists/*

# Copy requirements first (layer caching)
COPY requirements.txt .

# Install Python dependencies
RUN pip install --no-cache-dir --upgrade pip && \
    pip install --no-cache-dir -r requirements.txt

# Copy app code
COPY . .

# Create necessary directories
RUN mkdir -p logs uploads

# Expose port
EXPOSE 8000

# ── Production server: Gunicorn + Uvicorn workers ─────
# 4 workers handles ~50 concurrent users comfortably
CMD ["gunicorn", "main:app", \
     "--worker-class", "uvicorn.workers.UvicornWorker", \
     "--workers", "4", \
     "--bind", "0.0.0.0:8000", \
     "--timeout", "120", \
     "--keep-alive", "5", \
     "--access-logfile", "logs/access.log", \
     "--error-logfile", "logs/error.log", \
     "--log-level", "info"]
