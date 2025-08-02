pip install -r requirements.txt

# Environment variables təyin et
cp .env.example .env

# Aplikasiyanı başlat
uvicorn main:app --reload --host 0.0.0.0 --port 8000

# Və ya Docker ilə
docker-compose up -d