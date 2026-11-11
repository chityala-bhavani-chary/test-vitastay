FROM node:20-bookworm-slim

WORKDIR /app

COPY package.json package-lock.json ./
RUN npm ci --omit=dev

COPY . .
RUN mkdir -p uploads logs

EXPOSE 5000

CMD ["node", "server.js"]
