# Small base, no cache of dev tools
FROM python:3.12-slim

# Security hardening: non-root user
RUN useradd -m appuser
WORKDIR /app

# Install runtime deps
COPY requirements.txt .
RUN pip install --no-cache-dir -r requirements.txt

# Copy source
COPY app ./app

# Expose runtime port
EXPOSE 8080

# Run with gunicorn (prod-ready)
USER appuser
ENV PYTHONUNBUFFERED=1
CMD ["gunicorn", "-b", "0.0.0.0:8080", "app.main:app", "--workers", "2", "--threads", "4", "--timeout", "60"]
