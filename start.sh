#!/bin/sh
set -e

# Start Next.js standalone server with 0.0.0.0 binding
echo "Starting Next.js server on 0.0.0.0:8080..."
HOSTNAME=0.0.0.0 PORT=8080 node server.js &
PID=$!

# Wait a bit for server to start
echo "Waiting for server to be ready..."
sleep 3

echo "Server should be running on PID $PID"
# Keep the container running by waiting for the process
wait $PID
exit $?
