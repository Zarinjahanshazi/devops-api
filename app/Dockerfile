# Stage 1: Dependencies install
FROM node:20-alpine AS deps
WORKDIR /app
COPY package*.json ./
RUN npm ci --only=production

# Stage 2: Production image
FROM node:20-alpine AS production

# Security: dumb-init install (signal handling এর জন্য)
RUN apk add --no-cache dumb-init

WORKDIR /app

# Security: non-root user তৈরি করো
RUN addgroup -g 1001 -S nodejs && \
    adduser -S nodeuser -u 1001 -G nodejs

# Dependencies copy করো
COPY --from=deps --chown=nodeuser:nodejs /app/node_modules ./node_modules

# App code copy করো
COPY --chown=nodeuser:nodejs . .

# Non-root user হিসেবে চালাও
USER nodeuser

EXPOSE 3000

# Health check
HEALTHCHECK --interval=30s --timeout=10s --retries=3 \
  CMD wget -qO- http://localhost:3000/health || exit 1

# App চালাও
ENTRYPOINT ["dumb-init", "--"]
CMD ["node", "server.js"]