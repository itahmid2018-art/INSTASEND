# Multi-stage production Dockerfile for InstaSend
# Node.js 22 is required for native node:sqlite DatabaseSync engine

# Stage 1: Build frontend and transpile server
FROM node:22-alpine AS builder

WORKDIR /app

# Install build dependencies if needed
RUN apk add --no-cache python3 make g++

# Copy package files
COPY package*.json ./

# Install all dependencies including devDependencies for build
RUN npm ci

# Copy application source code
COPY . .

# Compile frontend bundle and server bundle
RUN npm run build

# Stage 2: Production runner
FROM node:22-alpine AS runner

WORKDIR /app

# Set production environment
ENV NODE_ENV=production \
    PORT=3000 \
    DATA_DIR=/app/data

# Install curl for container health checks
RUN apk add --no-cache curl

# Create data directory for SQLite database storage
RUN mkdir -p /app/data

# Copy built artifacts from builder
COPY --from=builder /app/package*.json ./
COPY --from=builder /app/dist ./dist
COPY --from=builder /app/server ./server
COPY --from=builder /app/node_modules ./node_modules

# Expose port (default 3000, can be overridden by $PORT at runtime)
EXPOSE 3000

# Health check against server API database status
HEALTHCHECK --interval=30s --timeout=5s --start-period=10s --retries=3 \
  CMD curl -f http://localhost:${PORT:-3000}/api/db/status || exit 1

# Start the compiled production server
CMD ["node", "dist/server.js"]
