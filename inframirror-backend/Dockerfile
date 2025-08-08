# Backend (FastAPI) üçün Dockerfile
FROM python:3.11-slim

# İş qovluğunu təyin et
WORKDIR /app

# Sistem paketlərini yeniləyib lazımi paketləri yüklə
RUN apt-get update && apt-get install -y \
    gcc \
    && rm -rf /var/lib/apt/lists/*

# Python dependencies'lari kopyala və yüklə  
COPY requirements.txt .
RUN pip install --no-cache-dir -r requirements.txt

# Aplikasiya kodunu kopyala
COPY . .

# Port açılışı
EXPOSE 8000

# Aplikasiyanı işə sal
CMD ["uvicorn", "main:app", "--host", "0.0.0.0", "--port", "8000"]