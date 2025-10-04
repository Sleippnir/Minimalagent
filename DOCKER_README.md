# Interview API - Docker Setup

This Docker setup runs the interview API server and handles bot launching via WebRTC transport.

## Prerequisites

- Docker and Docker Compose installed
- Environment variables configured (see .env.example)

## Environment Variables

Copy `.env.example` to `.env` and fill in your API keys:

```bash
SUPABASE_URL=your_supabase_url
SUPABASE_ANON_KEY=your_supabase_anon_key
DEEPGRAM_API_KEY=your_deepgram_key
ELEVENLABS_API_KEY=your_elevenlabs_key
ELEVENLABS_VOICE_ID=your_voice_id
GOOGLE_API_KEY=your_google_key
SIMLI_API_KEY=your_simli_key
SIMLI_FACE_ID=your_face_id
AUTH_TOKEN=test_token
```

## Running with Docker

1. **Build and start the services:**

   ```bash
   docker-compose up --build
   ```

2. **Run in background:**

   ```bash
   docker-compose up -d --build
   ```

3. **View logs:**

   ```bash
   docker-compose logs -f
   ```

## Ports

- **8001**: API server (FastAPI)
- **8080**: Frontend test interface (Nginx)
- **7860**: WebRTC bot client (when launched)

## API Endpoints

- `GET /health` - Health check
- `GET /interviews/{jwt_token}` - Get interview payload
- `GET /interviews/{jwt_token}?launch_bot=true` - Get interview payload and launch bot
- `POST /interviews/{interview_id}/transcript` - Submit transcript

## Testing the Setup

1. **Check service health:**

   ```bash
   curl http://localhost:8001/health
   curl http://localhost:8080/api/health
   ```

2. **Access the frontend interface:**
   Open `http://localhost:8080` in your browser to use the interview creation interface

3. **Test API proxying:**

   ```bash
   curl "http://localhost:8080/api/interviews/test_token?launch_bot=false"
   ```

## Current Status

✅ **API Service**: Running on port 8001, handles interview retrieval and bot launching  
✅ **Frontend Service**: Running on port 8080, serves HTML interface and proxies API calls  
✅ **Multi-service Architecture**: Separate containers for API and frontend with proper nginx proxying  
✅ **Dependencies**: All Python packages installed correctly including google-generativeai

## Architecture

- **API Service** (Port 8001): Python FastAPI server handling interview management and bot launching
- **Frontend Service** (Port 8080): Nginx serving the HTML test interface with API proxy
- **Bot Service** (Port 7860): WebRTC interview bots launched on-demand

When `?launch_bot=true` is used, the API spawns a bot subprocess that runs on port 7860 with WebRTC transport.

## Development

For development without Docker:

```bash
pip install -r requirements.txt
python -m uvicorn interview_api:app --host 0.0.0.0 --port 8001
```
