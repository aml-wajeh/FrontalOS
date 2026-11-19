FROM python:3.11-slim

WORKDIR /app

# ffmpeg + libgl1 are required by opencv-python-headless for video/image
# codecs even in headless mode; libglib2.0-0 covers a common opencv runtime
# dependency on slim base images.
RUN apt-get update && apt-get install -y --no-install-recommends \
    ffmpeg \
    libgl1 \
    libglib2.0-0 \
    && rm -rf /var/lib/apt/lists/*

COPY requirements.txt .
RUN pip install --no-cache-dir -r requirements.txt

COPY app/ ./app/
COPY models/ ./models/

ENV FRONTALOS_MODEL_PATH=./models/frontal_x3d_v2.pth
ENV PORT=8000

EXPOSE 8000

CMD ["uvicorn", "app.main:app", "--host", "0.0.0.0", "--port", "8000"]
