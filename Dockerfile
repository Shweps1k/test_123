# Node 24 LTS — в этой версии модуль node:sqlite доступен без экспериментальных флагов.
FROM node:24-slim

WORKDIR /app

# Сначала манифесты (зависимостей нет, но шаг оставлен на будущее и для кэширования слоёв).
COPY package*.json ./
RUN npm install --omit=dev

# Затем остальной код приложения.
COPY . .

ENV NODE_ENV=production
# Папка для файла базы данных — сюда монтируется постоянный диск (Volume) Railway.
ENV DATA_DIR=/data

# Railway сам подставит переменную окружения PORT.
EXPOSE 3000

CMD ["node", "server.js"]
