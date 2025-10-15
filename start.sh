#!/bin/sh
set -e

# Start Next.js standalone server with 0.0.0.0 binding
HOSTNAME=0.0.0.0 PORT=8080 node server.js &
PID=$!

# Wait for port to be ready (max 30 seconds)
for i in $(seq 1 30); do
  if nc -z localhost 8080 2>/dev/null; then
    echo "Server is ready!"
    # Keep the container running by waiting for the process
    wait $PID
    exit $?
  fi
  sleep 1
done

echo "Server failed to start within 30 seconds"
kill $PID 2>/dev/null || true
exit 1
