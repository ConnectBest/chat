#!/bin/sh
set -e

# Start Next.js in background
node server.js &
PID=$!

# Wait for port to be ready (max 30 seconds)
for i in $(seq 1 30); do
  if nc -z localhost 8080 2>/dev/null; then
    echo "Server is ready!"
    wait $PID
    exit $?
  fi
  sleep 1
done

echo "Server failed to start within 30 seconds"
kill $PID
exit 1
