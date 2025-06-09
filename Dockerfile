FROM node:18-alpine

WORKDIR /app

COPY package*.json ./

# Install both production and development dependencies to build TypeScript
RUN npm ci

COPY . .

# Build the TypeScript code
RUN npm run build

# After building, prune dev dependencies to reduce image size
RUN npm prune --production

RUN addgroup -g 1001 -S nodejs
RUN adduser -S botuser -u 1001

RUN chown -R botuser:nodejs /app
USER botuser

EXPOSE 3000

CMD ["node", "dist/index.js"]
