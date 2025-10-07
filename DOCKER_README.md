# Minimalagent - Docker Setup

This Docker setup runs the complete AI-powered HR interview platform with all background services.

## Prerequisites

- Docker and Docker Compose installed
- Environment variables configured (see .env.example)

## Performance & Reliability

This Docker setup uses `uv` for Python dependency management, which provides:

- **Faster installation**: 10-100x faster than pip
- **Better dependency resolution**: More reliable than pip's resolver
- **Reproducible builds**: Uses `uv.lock` for exact version pinning
- **Modern packaging**: Follows current Python packaging standards

## Environment Variables

Copy `.env.example` to `.env` and fill in your API keys:

```bash
SUPABASE_URL=your_supabase_url
SUPABASE_ANON_KEY=your_supabase_anon_key
GOOGLE_API_KEY=your_google_key
DEEPGRAM_API_KEY=your_deepgram_key
ELEVENLABS_API_KEY=your_elevenlabs_key
ELEVENLABS_VOICE_ID=your_voice_id
SIMLI_API_KEY=your_simli_key
SIMLI_FACE_ID=your_face_id
OPENAI_API_KEY=your_openai_key
DEEPSEEK_API_KEY=your_deepseek_key
OPENROUTER_API_KEY=your_openrouter_key
PERPLEXITY_API_KEY=your_perplexity_key
AUTH_TOKEN=test_token
```

## Services

The docker-compose.yml defines several services:

- **`api`**: FastAPI server handling interview orchestration and API endpoints
- **`background-evaluator`**: Continuous processing of completed interviews with AI evaluation
- **`content-maintenance`**: Scheduled content consistency maintenance (optional)
- **`frontend`**: Nginx serving the React HR dashboard

## Running with Docker

1. **Start all core services:**

   ```bash
   docker-compose up -d
   ```

2. **Include maintenance service:**

   ```bash
   docker-compose --profile maintenance up -d
   ```

3. **View logs:**

   ```bash
   docker-compose logs -f
   ```

4. **View specific service logs:**

   ```bash
   docker-compose logs -f background-evaluator
   ```

## Ports

- **8001**: API server (FastAPI)
- **8080**: Frontend HR dashboard (Nginx)
- **7861**: WebRTC bot client (when launched)

## Service Management

### Health Checks

All services include health checks:

- **API**: HTTP health check on `/health` endpoint
- **Background Evaluator**: Process existence check
- **Frontend**: Nginx availability

### Scaling Services

```bash
# Scale API service
docker-compose up -d --scale api=3

# Scale background evaluators
docker-compose up -d --scale background-evaluator=2
```

### Maintenance Operations

```bash
# Run content maintenance manually
docker-compose run --rm api python scripts/maintain_content.py

# Run database audit
docker-compose run --rm api python scripts/content_manager.py audit
```

## API Endpoints

- `GET /health` - Health check
- `GET /interviews/{jwt_token}` - Get interview payload
- `POST /interviews/{interview_id}/transcript` - Submit transcript
- `GET /admin/bot-processes` - Monitor active bot processes
- `POST /admin/cleanup/{interview_id}` - Cleanup bot processes

## Testing the Setup

1. **Check service health:**

   ```bash
   curl http://localhost:8001/health
   ```

2. **Access the HR dashboard:**
   Open `http://localhost:8080` in your browser

3. **Check background evaluator:**

   ```bash
   docker-compose logs background-evaluator
   ```

## Current Status

✅ **API Service**: FastAPI server with comprehensive interview management  
✅ **Background Evaluator**: Continuous AI-powered evaluation processing  
✅ **Content Maintenance**: Automated tag consistency and relationship management  
✅ **Frontend Service**: React HR dashboard with full interview creation workflow  
✅ **Multi-service Architecture**: Proper service separation with health checks  
✅ **Production Ready**: Environment-based configuration and scaling support  

## Architecture

- **API Service** (Port 8001): FastAPI server handling interview orchestration, bot management, and content operations
- **Background Evaluator** (No port): Continuous processing service for AI evaluation
- **Content Maintenance** (Optional): Scheduled service for data consistency
- **Frontend Service** (Port 8080): Nginx serving the React HR dashboard
- **Bot Service** (Port 7861): WebRTC interview bots launched on-demand

## Development

For development without Docker:

```bash
# Install uv (if not already installed)
pip install uv

# Install dependencies using uv (recommended)
uv sync

# Or use pip with requirements.txt (legacy)
pip install -r requirements.txt

# Start services
python -m uvicorn interview_api:app --host 0.0.0.0 --port 8001 &
python -m interview.evaluator.background_evaluator &
cd frontend && npm run dev
```

## Troubleshooting

### Common Issues

1. **Background evaluator not processing:**

   ```bash
   docker-compose logs background-evaluator
   # Check for API key configuration issues
   ```

2. **Content maintenance failing:**

   ```bash
   docker-compose run --rm api python scripts/maintain_content.py
   # Check Supabase connection and permissions
   ```

3. **Bot processes not cleaning up:**

   ```bash
   curl http://localhost:8001/admin/bot-processes
   # Use cleanup endpoint if needed
   ```
