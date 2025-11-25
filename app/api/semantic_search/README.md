# ConnectBest Semantic Search API

FastAPI-based semantic search API for chat messages using sentence embeddings.

## Features

- 🔍 **Semantic Search**: Natural language search using sentence-transformers
- 🔐 **Permission-Aware**: Only searches messages in channels the user has access to
- 📊 **Cosine Similarity**: Ranks results by semantic similarity (0.0 to 1.0)
- 🚀 **Fast & Efficient**: Uses pre-computed embeddings stored in MongoDB
- 🐳 **Dockerized**: Easy deployment with Docker Compose

## API Endpoints

### POST `/api/semantic-search`
Perform semantic search on messages accessible to a user.

**Request Body:**
```json
{
  "username": "Alice Smith",
  "query": "programming bugs and debugging issues",
  "top_k": 5
}
```

**Response:**
```json
{
  "username": "Alice Smith",
  "query": "programming bugs and debugging issues",
  "accessible_channels": 6,
  "total_messages_searched": 87,
  "top_k": 5,
  "results": [
    {
      "message_id": "msg-123",
      "text": "Fixed the bug! Turns out it was a race condition.",
      "created_at": "2025-11-15T14:30:00Z",
      "author_name": "Bob Johnson",
      "channel_name": "engineering",
      "similarity_score": 0.8234
    }
  ]
}
```

### GET `/api/users`
List all users with message embeddings.

**Response:**
```json
{
  "total_users": 10,
  "users": [
    {
      "_id": "user-123",
      "display_name": "Alice Smith",
      "email": "alice.smith@connectbest.com",
      "message_count": 45
    }
  ]
}
```

### GET `/health`
Health check endpoint.

**Response:**
```json
{
  "status": "healthy",
  "model": "all-MiniLM-L6-v2",
  "dimensions": 384
}
```

## Environment Variables

Create a `.env.local` file in the project root:

```bash
MONGO_URI=mongodb+srv://username:password@cluster.mongodb.net/?retryWrites=true&w=majority
```

## Local Development

### Install Dependencies
```bash
pip install -r requirements.txt
```

### Run the Server
```bash
python api.py
# or
uvicorn api:app --reload --port 8001
```

### Interactive API Docs
- Swagger UI: http://localhost:8001/docs
- ReDoc: http://localhost:8001/redoc

## Docker Deployment

### Build and Run
```bash
docker-compose up --build
```

### Run in Background
```bash
docker-compose up -d
```

### View Logs
```bash
docker-compose logs -f
```

### Stop Container
```bash
docker-compose down
```

## Testing with cURL

### Semantic Search
```bash
curl -X POST http://localhost:8001/api/semantic-search \
  -H "Content-Type: application/json" \
  -d '{
    "username": "Alice Smith",
    "query": "project deadlines and milestones",
    "top_k": 5
  }'
```

### List Users
```bash
curl http://localhost:8001/api/users
```

### Health Check
```bash
curl http://localhost:8001/health
```

## How It Works

1. **User Authentication**: Verifies user exists and gets their accessible channels
2. **Query Encoding**: Converts search query to 384-dimensional vector using `all-MiniLM-L6-v2`
3. **Permission Filter**: Fetches embeddings only from channels the user is a member of
4. **Similarity Calculation**: Computes cosine similarity between query and message embeddings
5. **Ranking**: Sorts results by similarity score (highest first)
6. **Top-K Results**: Returns the most relevant messages with context

## Embedding Model

- **Model**: `all-MiniLM-L6-v2` (sentence-transformers)
- **Dimensions**: 384
- **Speed**: ~14,000 sentences/sec on CPU
- **Quality**: High quality semantic representations

## Performance

- Embeddings are pre-computed and stored in MongoDB
- Search queries are fast (only query encoding + similarity calculation)
- Typical response time: 100-500ms for 200 messages

## Error Handling

- **404**: User not found or no accessible channels
- **422**: Invalid request body (validation error)
- **500**: Internal server error

## CORS

CORS is enabled for all origins. Configure in production:

```python
app.add_middleware(
    CORSMiddleware,
    allow_origins=["https://yourdomain.com"],
    allow_credentials=True,
    allow_methods=["GET", "POST"],
    allow_headers=["*"],
)
```

## Production Considerations

- Set up proper authentication/authorization
- Configure CORS for specific domains
- Add rate limiting
- Monitor embedding model memory usage (~400MB)
- Consider caching frequently searched queries
- Add logging and monitoring

## License

MIT
