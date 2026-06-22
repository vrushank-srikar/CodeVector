FROM node:20-alpine

WORKDIR /app

# Cache npm install layer separately
COPY package*.json ./
RUN npm ci --only=production

# Explicitly copy each directory so nothing is missed
COPY src/   ./src/
COPY scripts/ ./scripts/
COPY public/  ./public/

EXPOSE 3000

CMD ["node", "src/index.js"]
