#!/bin/sh
set -e

# Start Next.js standalone server with 0.0.0.0 binding
echo "Starting Next.js server on 0.0.0.0:8080..."
HOSTNAME=0.0.0.0 PORT=8080 node server.js &
PID=$!

# Wait for port to be ready (max 30 seconds)
echo "Waiting for server to start..."
for i in $(seq 1 30); do
  if nc -z localhost 8080 2>/dev/null; then
    echo "Server is ready and listening on port 8080!"
    # Test local health check
    if command -v curl >/dev/null 2>&1; then
      echo "Testing health check endpoint..."
      curl -v http://localhost:8080/ 2>&1 | head -20 || true
    fi
    # Keep the container running by waiting for the process
    wait $PID
    exit $?
  fi
  echo "Attempt $i/30..."
  sleep 1
done

echo "Server failed to start within 30 seconds"
kill $PID 2>/dev/null || true
exit 1
