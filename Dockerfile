# =============================================================================
# Multi-Stage Dockerfile: Next.js Frontend + Flask Backend
# Runs both services in a single container using supervisord
# =============================================================================

# -----------------------------------------------------------------------------
# Stage 1: Build Next.js Frontend
# -----------------------------------------------------------------------------
FROM node:20-slim AS frontend-builder

WORKDIR /app

# Build args
ARG CACHEBUST=1
ARG NEXT_PUBLIC_WEBSOCKET_URL
ARG NEXT_PUBLIC_API_URL=http://localhost:5001/api
ARG NEXT_PUBLIC_WS_URL=http://localhost:5001

# Copy package files first for better layer caching
COPY package*.json ./

# Install dependencies
RUN npm install --registry=https://registry.npmjs.org/ --no-audit

# Copy frontend source files
COPY app ./app
COPY components ./components
COPY lib ./lib
COPY public ./public
COPY next.config.js ./
COPY tsconfig.json ./
COPY tailwind.config.js ./
COPY postcss.config.js ./
COPY middleware.ts ./

# Build Next.js with env vars
ENV NEXT_PUBLIC_WEBSOCKET_URL=$NEXT_PUBLIC_WEBSOCKET_URL
ENV NEXT_PUBLIC_API_URL=$NEXT_PUBLIC_API_URL
ENV NEXT_PUBLIC_WS_URL=$NEXT_PUBLIC_WS_URL
RUN npm run build

# -----------------------------------------------------------------------------
# Stage 2: Production - Combined Frontend + Backend
# -----------------------------------------------------------------------------
FROM python:3.12-slim AS production

WORKDIR /app

# Install Node.js in the Python image
RUN apt-get update && \
    apt-get install -y --no-install-recommends \
    curl \
    ca-certificates \
    openssl \
    supervisor && \
    curl -fsSL https://deb.nodesource.com/setup_20.x | bash - && \
    apt-get install -y nodejs && \
    rm -rf /var/lib/apt/lists/*

# Create non-root user for security
RUN addgroup --system --gid 1001 appuser && \
    adduser --system --uid 1001 --gid 1001 appuser

# -----------------------------------------------------------------------------
# Install Backend Dependencies
# -----------------------------------------------------------------------------
WORKDIR /app/backend

COPY backend/requirements.txt ./
RUN pip install --no-cache-dir -r requirements.txt

# Copy backend code
COPY --chown=appuser:appuser backend/ ./

# Create necessary directories for backend
RUN mkdir -p static/uploads && \
    chown -R appuser:appuser static/uploads

# -----------------------------------------------------------------------------
# Install Frontend
# -----------------------------------------------------------------------------
WORKDIR /app/frontend

# Copy built Next.js from builder
COPY --from=frontend-builder --chown=appuser:appuser /app/.next/standalone ./
COPY --from=frontend-builder --chown=appuser:appuser /app/.next/static ./.next/static
COPY --from=frontend-builder --chown=appuser:appuser /app/public ./public

# -----------------------------------------------------------------------------
# Configure Supervisord
# -----------------------------------------------------------------------------
WORKDIR /app

# Copy supervisor config
COPY supervisord.conf /etc/supervisor/conf.d/supervisord.conf

# Create log directories
RUN mkdir -p /var/log/supervisor && \
    chown -R appuser:appuser /var/log/supervisor

# Expose ports
EXPOSE 8080 5001

# Environment variables
ENV PORT=8080
ENV HOSTNAME=0.0.0.0
ENV PYTHONUNBUFFERED=1
ENV NODE_ENV=production

# Switch to non-root user
USER appuser

# Start supervisord (manages both Next.js and Flask)
CMD ["/usr/bin/supervisord", "-c", "/etc/supervisor/conf.d/supervisord.conf"]
