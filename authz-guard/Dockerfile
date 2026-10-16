# Build stage: compile strict TypeScript
FROM node:22-alpine AS builder

WORKDIR /build

# Copy dependency manifests
COPY package.json package-lock.json ./

# Install build dependencies including native SQLite tools
RUN apk add --no-cache python3 make g++ && \
    npm ci

# Copy source code and config
COPY tsconfig.json ./
COPY src/ ./src/
COPY openapi.yaml ./

# Compile TypeScript to dist/
RUN npm run build

# Prune dev dependencies for production image
RUN npm prune --omit=dev

# -----------------------------------------------------------
# Production stage: minimal non-root runtime container
FROM node:22-alpine AS runner

WORKDIR /app

ENV NODE_ENV=production
ENV PORT=3000

# Install runtime dependencies for better-sqlite3
RUN apk add --no-cache dumb-init

# Copy node_modules and compiled artifacts from builder
COPY --from=builder /build/node_modules ./node_modules
COPY --from=builder /build/dist ./dist
COPY --from=builder /build/package.json ./package.json
COPY --from=builder /build/openapi.yaml ./openapi.yaml
COPY src/database/schema.sql ./src/database/schema.sql

# Create persistent data directory and assign ownership to non-root user 'node'
RUN mkdir -p /app/data && chown -R node:node /app

# Run container as non-root user
USER node

EXPOSE 3000

# Container healthcheck
HEALTHCHECK --interval=30s --timeout=5s --start-period=10s --retries=3 \
  CMD wget --no-verbose --tries=1 --spider http://127.0.0.1:3000/health/live || exit 1

ENTRYPOINT ["/usr/bin/dumb-init", "--"]
CMD ["node", "dist/server.js"]
