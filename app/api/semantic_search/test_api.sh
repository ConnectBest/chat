#!/bin/bash

# ConnectBest Semantic Search API - Test Script
# This script demonstrates all API endpoints

BASE_URL="http://localhost:8001"

echo "======================================================================"
echo "ConnectBest Semantic Search API - Test Suite"
echo "======================================================================"
echo ""

# Test 1: Health Check
echo "✅ Test 1: Health Check"
echo "----------------------------------------------------------------------"
curl -s "$BASE_URL/health" | jq .
echo ""
echo ""

# Test 2: List Users
echo "✅ Test 2: List Users with Embeddings"
echo "----------------------------------------------------------------------"
curl -s "$BASE_URL/api/users" | jq '{total_users: .total_users, top_3_users: .users[:3]}'
echo ""
echo ""

# Test 3: Semantic Search - Technical Query
echo "✅ Test 3: Semantic Search - Technical Query"
echo "----------------------------------------------------------------------"
echo "Query: 'programming bugs and debugging issues'"
curl -s -X POST "$BASE_URL/api/semantic-search" \
  -H "Content-Type: application/json" \
  -d '{
    "username": "Alice Smith",
    "query": "programming bugs and debugging issues",
    "top_k": 3
  }' | jq '{username: .username, query: .query, accessible_channels: .accessible_channels, total_searched: .total_messages_searched, top_result: .results[0]}'
echo ""
echo ""

# Test 4: Semantic Search - Meeting Query
echo "✅ Test 4: Semantic Search - Meeting Query"
echo "----------------------------------------------------------------------"
echo "Query: 'team meetings and collaboration'"
curl -s -X POST "$BASE_URL/api/semantic-search" \
  -H "Content-Type: application/json" \
  -d '{
    "username": "Bob Johnson",
    "query": "team meetings and collaboration",
    "top_k": 2
  }' | jq '{username: .username, query: .query, results: [.results[] | {text: .text, author: .author_name, channel: .channel_name, score: .similarity_score}]}'
echo ""
echo ""

# Test 5: Semantic Search - Celebration Query
echo "✅ Test 5: Semantic Search - Celebration Query"
echo "----------------------------------------------------------------------"
echo "Query: 'celebration success achievements'"
curl -s -X POST "$BASE_URL/api/semantic-search" \
  -H "Content-Type: application/json" \
  -d '{
    "username": "Charlie Williams",
    "query": "celebration success achievements",
    "top_k": 3
  }' | jq '{username: .username, query: .query, results: [.results[] | {text: .text, score: .similarity_score}]}'
echo ""
echo ""

# Test 6: Error Handling - User Not Found
echo "✅ Test 6: Error Handling - User Not Found"
echo "----------------------------------------------------------------------"
curl -s -X POST "$BASE_URL/api/semantic-search" \
  -H "Content-Type: application/json" \
  -d '{
    "username": "NonExistent User",
    "query": "test query",
    "top_k": 5
  }' | jq .
echo ""
echo ""

echo "======================================================================"
echo "✅ All Tests Completed!"
echo "======================================================================"
echo ""
echo "Interactive API Docs:"
echo "  - Swagger UI: http://localhost:8001/docs"
echo "  - ReDoc:      http://localhost:8001/redoc"
echo ""
