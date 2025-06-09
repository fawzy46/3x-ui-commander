FROM node:18-alpine

WORKDIR /app

COPY package*.json ./

RUN npm ci --only=production

COPY . .

RUN npm run build

RUN addgroup -g 1001 -S nodejs
RUN adduser -S botuser -u 1001

RUN chown -R botuser:nodejs /app
USER botuser

EXPOSE 3000

CMD ["node", "dist/index.js"]
