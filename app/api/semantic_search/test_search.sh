#!/bin/bash
# Test Semantic Search

echo "Testing Semantic Search..."

# 1. Health Check
echo "1. Health Check"
curl -s http://localhost:8001/health | jq .
echo ""

# 2. Search (Mock)
# Needs a user that exists in DB.
echo "2. Search for 'deployment'"
curl -X POST http://localhost:8001/api/semantic-search \
  -H "Content-Type: application/json" \
  -d '{
    "username": "alice",
    "query": "deployment",
    "top_k": 1
  }' | jq .
echo ""
