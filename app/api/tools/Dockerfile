# ==============================================================================
# ConnectBest AI Agent - Production Container
# ==============================================================================
# Deploys to AWS with environment variables injected at runtime
# Endpoints:
#   - POST /chat - AI agent chat
#   - GET/POST /api/semantic-search - Vector search
#   - GET /health - Health check
#   - GET /tools - List available tools
# ==============================================================================

FROM python:3.11-slim

# Set working directory
WORKDIR /app

# Build-time labels for traceability
ARG BUILD_DATE
ARG GIT_COMMIT
LABEL org.opencontainers.image.created="${BUILD_DATE}" \
      org.opencontainers.image.revision="${GIT_COMMIT}" \
      org.opencontainers.image.title="ConnectBest AI Agent" \
      org.opencontainers.image.vendor="ConnectBest"

# Environment variables for Python optimization
ENV PYTHONDONTWRITEBYTECODE=1 \
    PYTHONUNBUFFERED=1 \
    PYTHONPATH=/app \
    LOKY_MAX_CPU_COUNT=1 \
    # FastEmbed cache directory
    FASTEMBED_CACHE_PATH=/app/.cache/fastembed

# Install system dependencies
RUN apt-get update && apt-get install -y --no-install-recommends \
    build-essential \
    curl \
    && rm -rf /var/lib/apt/lists/* \
    && apt-get clean

# Copy requirements first for better caching
COPY requirements.txt .

# Install Python dependencies (FastEmbed - no torch needed)
RUN pip install --no-cache-dir --upgrade pip && \
    pip install --no-cache-dir -r requirements.txt

# Copy application code
COPY . .

# Create non-root user for security and cache directory
RUN adduser --disabled-password --gecos '' appuser && \
    mkdir -p /app/.cache/fastembed && \
    chown -R appuser:appuser /app
USER appuser

# Expose port
EXPOSE 8001

# Health check
HEALTHCHECK --interval=30s --timeout=10s --start-period=60s --retries=3 \
    CMD curl -f http://localhost:8001/health || exit 1

# Run the API server with production settings
CMD ["uvicorn", "api:app", "--host", "0.0.0.0", "--port", "8001", "--workers", "1"]
