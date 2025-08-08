# Frontend (React) üçün Dockerfile
FROM node:18-alpine

# İş qovluğunu təyin et
WORKDIR /app

# Package.json və package-lock.json fayllarını kopyala
COPY package*.json ./

# Dependencies'ları yüklə
RUN npm install

# Aplikasiya kodunu kopyala
COPY . .

# Aplikasiyanı build et
RUN npm run build

# Production server kimi serve istifadə et
RUN npm install -g serve

# Port açılışı
EXPOSE 3000

# Build edilmiş aplikasiyanı serve et
CMD ["serve", "-s", "build", "-l", "3000"]