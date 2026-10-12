FROM python:3.12-slim

# Install system dependencies required by OpenCV and PyMuPDF
RUN apt-get update && apt-get install -y --no-install-recommends \
    libgl1 \
    libglib2.0-0 \
    libgomp1 \
    && rm -rf /var/lib/apt/lists/*

WORKDIR /app

# Copy requirements and install
COPY backend/requirements.txt /app/requirements.txt
RUN pip install --no-cache-dir -r /app/requirements.txt

# Copy backend code and sample data
COPY backend/ /app/backend/

# Set Python path so backend.app is resolvable
ENV PYTHONPATH=/app
ENV PORT=8000
EXPOSE 8000

# Run FastAPI with Uvicorn
CMD ["sh", "-c", "uvicorn backend.app.main:app --host 0.0.0.0 --port ${PORT}"]
