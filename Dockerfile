# Build stage
FROM node:20-slim AS builder

WORKDIR /app

# Build arg to bust cache when needed
ARG CACHEBUST=1

# Copy package files
COPY package*.json ./

# Install all dependencies (including devDependencies for build)
RUN npm ci --no-audit

# Copy source files
COPY . .

# Build Next.js app
RUN npm run build

# Production stage
FROM node:20-slim AS runner

WORKDIR /app

# Security hardening: non-root user
RUN addgroup --system --gid 1001 nodejs
RUN adduser --system --uid 1001 nextjs

# Copy necessary files from builder
COPY --from=builder --chown=nextjs:nodejs /app/.next/standalone ./
COPY --from=builder --chown=nextjs:nodejs /app/.next/static ./.next/static

USER nextjs

EXPOSE 8080

ENV PORT=8080
ENV HOSTNAME="0.0.0.0"

CMD ["node", "server.js"]
