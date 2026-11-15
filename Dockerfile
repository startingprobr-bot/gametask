FROM node:22-alpine
WORKDIR /app
COPY package*.json ./
RUN npm install --omit=dev
COPY . .
ENV NODE_ENV=production TZ=America/Sao_Paulo
EXPOSE 3000
CMD ["node", "server.js"]
