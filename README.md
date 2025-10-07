# Minimalagent - AI-Powered HR Interview Platform

An end-to-end AI-powered interview platform that automates the entire recruitment process from scheduling to evaluation. Features conversational AI interviewers, multi-LLM evaluation, and comprehensive HR dashboards.

## 🏗️ Architecture Overview

### Core Components

- **Frontend**: React 18 + Vite SPA with HR dashboards and candidate portals
- **Backend**: FastAPI server handling interview orchestration and API endpoints
- **Database**: Supabase PostgreSQL with real-time capabilities
- **AI Services**: Pipecat conversational bots, Google Cloud Speech, multiple LLM evaluators
- **Video**: Daily.co WebRTC for real-time video interviews
- **Infrastructure**: Docker containerization for API, evaluator, and frontend services

### Data Flow Architecture
<details>
<summary>Architecture Diagram</summary>

```mermaid
graph TD
    A[HR Dashboard] --> B[Supabase Edge Functions]
    B --> C[Interview API]
    A --> D[Magic Link Generation]
    D --> E[Candidate Portal]
    E --> F[Video Call - Daily.co]
    F --> G[AI Interview Bot - Pipecat]
    G --> H[Transcript Processing]
    H --> I[Multi-LLM Evaluation]
    I --> J[Results Dashboard]
    J --> K[HR Review & Decision]
```
<summary>Architecture Diagram</summary>


## 🚀 Quick Start

### Prerequisites

- Python 3.12+
- Node.js 18+
- Docker & Docker Compose
- Supabase account
- API keys for AI services (Google Cloud, OpenAI, etc.)

### Environment Setup

1. **Clone the repository**

   ```bash
   git clone https://github.com/Sleippnir/Minimalagent.git
   cd Minimalagent
   ```

2. **Backend Setup**

   ```bash
   # Install Python dependencies
   pip install -r requirements.txt

   # Copy environment template and configure
   cp .env.example .env
   # Edit .env with your API keys and Supabase credentials
   ```

3. **Frontend Setup**

   ```bash
   cd frontend
   npm install

   # Create environment file
   cp .env.example .env.local
   # Add your Supabase credentials to .env.local
   ```

4. **Database Setup**

   ```bash
   # Run database migrations (via Supabase dashboard or CLI)
   # Reference the schema in docs/supabase_tables.md
   ```

### Running the Application

1. **Start with Docker (Recommended)**

   ```bash
   docker-compose up -d
   ```

   This starts all core services:
   - `api`: FastAPI server on port 8001
   - `background-evaluator`: Continuous evaluation processing
   - `frontend`: Nginx serving React app on port 8080
   - Interview bots launched on-demand on port 7861

   For maintenance operations:

   ```bash
   docker-compose --profile maintenance up -d
   ```

2. **Manual Startup**

   ```bash
   # Terminal 1: Start backend API
   python -m uvicorn interview_api:app --host 0.0.0.0 --port 8001

   # Terminal 2: Start frontend
   cd frontend && npm run dev

   # Terminal 3: Start background evaluator
   python -m interview.evaluator.background_evaluator

   # Optional: Start content maintenance (run periodically)
   python scripts/maintain_content.py
   ```

3. **Access the application**
   - **Production (Docker)**: HR Dashboard at `http://localhost:8080/dashboards/hr/`
   - **Development**: HR Dashboard at `http://localhost:5173/dashboards/hr/` (Vite dev server)
   - API Documentation: `http://localhost:8001/docs`
   - Health Check: `http://localhost:8001/health`
   - Interview Bot: `http://localhost:7861/client` (when active)

## � Development Configuration

### Frontend Development Server

The frontend uses Vite for development with automatic API proxying:

```javascript
// frontend/vite.config.js
server: {
  proxy: {
    '/api': {
      target: 'http://localhost:8001',  // Proxies to API container
      changeOrigin: true,
      rewrite: (path) => path.replace(/^\/api/, '')
    }
  }
}
```

**Important**: Ensure the Vite proxy targets port `8001` (API container), not `8000`.

### Bot Launching

Interview bots are launched as Python modules for proper relative imports:

```python
# Correct: Module execution
process = subprocess.Popen([
    sys.executable, "-m", "interview.bots.simlibot"
], ...)

# Incorrect: Direct script execution (causes import errors)
process = subprocess.Popen([
    sys.executable, "interview/bots/simlibot.py"
], ...)
```

## �📋 API Endpoints

### Core Interview Management

#### `GET /health`

Health check endpoint.

```json
{
  "status": "healthy",
  "service": "interview-api"
}
```

#### `GET /interviews/{jwt_token}`

Retrieve interview context for candidates.

- **Purpose**: Get complete interview payload using JWT token
- **Response**: Interview data including candidate, job, questions, and AI prompts

#### `POST /interviews/{interview_id}/transcript`

Submit completed interview transcript.

- **Body**:

```json
{
  "turns": [
    {"speaker": "Interviewer", "text": "Tell me about yourself"},
    {"speaker": "Candidate", "text": "I'm a software engineer..."}
  ]
}
```

### Administrative Endpoints

#### `GET /admin/bot-processes`

Monitor active bot processes.

- **Response**: List of running interview bots with PIDs and runtime

#### `POST /admin/cleanup/{interview_id}`

Manually terminate bot processes.

### Content Management (Admin)

#### `POST /admin/content/validate-job-tags`

Generate semantic tags for job descriptions.

#### `POST /admin/content/validate-question-tags`

Generate semantic tags for interview questions.

#### `POST /admin/content/fix-job/{job_id}`

Update tags for existing jobs.

#### `POST /admin/content/fix-question/{question_id}`

Update tags for existing questions.

#### `GET /admin/content/audit`

Audit content consistency across jobs and questions.

#### `POST /admin/content/bulk-fix`

Fix all content consistency issues.

#### `POST /admin/content/refresh-relationships/{job_id}`

Refresh question-job relationships based on tags.

## 🔧 Supabase Edge Functions

### `schedule-interview`

**Purpose**: Create and schedule new interviews

**Input**:

```json
{
  "application_id": "uuid",
  "question_ids": ["uuid1", "uuid2"],
  "resume_path": "resumes/file.pdf",
  "interviewer_prompt_version_id": "uuid",
  "evaluator_prompt_version_id": "uuid"
}
```

**Process**:

1. Downloads and processes resume from Supabase Storage
2. Fetches prompts and rubric versions
3. Creates interview record in `interviews` table
4. Generates interview script in `interview_questions`
5. Queues payload in `interviewer_queue`
6. Triggers email notification

### `send-login-links`

**Purpose**: Send magic link emails to candidates

**Process**:

1. Generates Supabase Auth magic links
2. Sends HTML emails with secure login URLs
3. Updates notification status

### `reprocess-interview`

**Purpose**: Re-queue existing interviews for processing (retry failed interviews, fix stuck interviews)

**Input**:

```json
{
  "interview_id": "uuid"
}
```

**Process**:

1. Fetches complete interview data from database (candidate, job, questions, prompts)
2. Reconstructs the interview payload
3. Safely upserts payload back into `interviewer_queue`
4. Returns success confirmation

**Use Cases**:

- Retry interviews that failed during initial processing
- Re-queue interviews that got stuck in the system
- Manually trigger interview processing for debugging
- Fix orphaned interviews missing from the queue

### Automated Stuck Interview Recovery

**Database Function**: `reprocess_stuck_interviews()`

**Purpose**: Automatically detect and fix stuck interviews

**Process**:

1. Scans for interviews created >5 minutes ago missing from `interviewer_queue`
2. Calls `reprocess-interview` edge function for each stuck interview
3. Logs all recovery attempts

**Usage**:

```sql
-- Manual execution
select reprocess_stuck_interviews();

-- Schedule with pg_cron (if available)
select cron.schedule('reprocess-stuck-interviews', '*/30 * * * *', 'select reprocess_stuck_interviews();');
```

**Requirements**:

- `pg_net` extension enabled in Supabase
- Service role key configured
- `created_at` column in `interviews` table

## 🗄️ Database Schema

### Core Entities

- **`candidates`**: Candidate profiles and contact information
- **`jobs`**: Job descriptions with semantic tags
- **`questions`**: Interview question bank with categories
- **`applications`**: Candidate-job application links

### Version Control

- **`prompts`** & **`prompt_versions`**: Versioned AI prompts for interviewers/evaluators
- **`rubrics`** & **`rubric_versions`**: Structured evaluation criteria

### Workflow Tables

- **`interviews`**: Central interview orchestration
- **`interview_questions`**: Ordered question scripts
- **`interviewer_queue`**: Active interview payloads
- **`evaluator_queue`**: Completed interviews awaiting evaluation

### Results & Analytics

- **`transcripts`**: Raw conversation data
- **`evaluations`**: Multi-LLM assessment results

## 🤖 AI Components

### Interview Bot (Pipecat)

- **Framework**: Pipecat AI for conversational interfaces
- **Speech**: Google Cloud Speech-to-Text, Text-to-Speech
- **Context**: Dynamic conversation management with memory
- **Tools**: Context cleaning, conversation termination

### Multi-LLM Evaluation

- **OpenAI GPT-4o**: Primary technical/behavioral assessment
- **Google Gemini-2.5-flash**: Alternative evaluation perspective
- **DeepSeek (OpenRouter)**: Additional validation
- **Rubric-Based**: Structured scoring against predefined criteria

### Background Processing

- **Agent**: `BackgroundEvaluatorAgent` polls `evaluator_queue`
- **Trigger**: Automatic evaluation after transcript submission
- **Storage**: Results stored with full LLM response metadata

## 🎯 Key Features

### For HR Teams

- **Interview Scheduling**: Drag-and-drop question selection, resume upload
- **Real-time Monitoring**: Live bot process tracking, interview status
- **Multi-perspective Evaluation**: 3 LLM evaluations per interview
- **Content Management**: Automated tagging and relationship management

### For Candidates

- **Seamless Experience**: Magic link login, no account creation
- **Natural Conversation**: AI interviewer adapts to responses
- **Video Interface**: Professional video call experience

### For Developers

- **Extensible Architecture**: Modular design for custom integrations
- **Comprehensive APIs**: RESTful endpoints for all operations
- **Real-time Updates**: Supabase real-time subscriptions
- **Containerized**: Docker deployment with environment isolation

## 🔒 Security & Privacy

- **JWT Authentication**: Single-use tokens for candidate access
- **Supabase Auth**: Secure user management and magic links
- **Data Encryption**: All sensitive data encrypted at rest
- **Access Control**: Role-based permissions (HR, Candidate, Admin)

## ⚙️ Background Processes & Maintenance

### Core Background Services

#### 1. Background Evaluator (`interview/evaluator/background_evaluator.py`)

- **Purpose**: Processes completed interviews with AI evaluation
- **Trigger**: Runs continuously, polls `evaluator_queue` every 30 seconds
- **Function**: Multi-LLM evaluation (OpenAI GPT-4o, Google Gemini, DeepSeek)
- **Output**: Structured evaluation results stored in database

#### 2. Interview Bot Processes

- **Purpose**: Handle real-time AI-powered interviews
- **Trigger**: Launched automatically when candidates access interview URLs
- **Function**: Pipecat-based conversational AI with speech processing
- **Management**: Monitored via `/admin/bot-processes` endpoint

### Maintenance Scripts (Run Periodically)

#### 3. Content Maintenance (`scripts/maintain_content.py`)

- **Purpose**: Ensures tag consistency between jobs and questions
- **Frequency**: Run daily or after bulk content updates
- **Function**: Audits and fixes content relationships using `AutomatedTagger`

#### 4. Content Manager Operations

- **Purpose**: Bulk operations for content consistency
- **Available Operations**:
  - Tag validation for new content
  - Bulk fixing of existing content issues
  - Relationship optimization between jobs and questions
  - Comprehensive content auditing

### Recommended Cron Jobs

```bash
# Daily content maintenance (run at 2 AM)
0 2 * * * /path/to/minimalagent/scripts/maintain_content.py

# Weekly comprehensive audit (run Sundays at 3 AM)
0 3 * * 0 /path/to/minimalagent/scripts/content_manager.py audit
```

## 📊 Monitoring & Analytics

- **Health Checks**: Automated service monitoring
- **Bot Process Tracking**: Real-time bot status and cleanup
- **Content Auditing**: Automated consistency validation
- **Performance Metrics**: Interview completion rates, evaluation scores

## 🚀 Deployment

### Production Setup

1. **Supabase**: Deploy edge functions and configure database
2. **Docker Services**: Deploy all containers with proper orchestration
   - `api`: Main application server
   - `background-evaluator`: Continuous evaluation processing
   - `content-maintenance`: Scheduled content maintenance (optional)
   - `frontend`: Static file serving
3. **Environment**: Configure production API keys and secrets
4. **Domain**: Set up custom domain with SSL
5. **Monitoring**: Configure logging and alerting

### Scaling Considerations

- **API Service**: Horizontal scaling with multiple instances behind load balancer
- **Background Evaluator**: Can run multiple instances for parallel processing
- **Content Maintenance**: Run on schedule or as needed, not continuously
- **Database**: Supabase handles scaling automatically
- **AI Services**: Rate limiting and cost optimization across all LLM providers
- **Storage**: CDN for resume files and transcripts

## 🤝 Contributing

1. Fork the repository
2. Create a feature branch
3. Make your changes
4. Add tests for new functionality
5. Submit a pull request

## � Troubleshooting

### Common Issues

#### Interview Bot Import Errors
**Error**: `ImportError: attempted relative import with no known parent package`

**Solution**: Ensure bots are launched as modules, not scripts:
```bash
# Correct
python -m interview.bots.simlibot

# Incorrect  
python interview/bots/simlibot.py
```

#### Frontend API Connection Issues
**Error**: `500 Internal Server Error` when starting interviews

**Cause**: Vite dev server proxy misconfiguration

**Solution**: Verify `frontend/vite.config.js` proxies to correct port:
```javascript
proxy: {
  '/api': {
    target: 'http://localhost:8001',  // Must be 8001, not 8000
    changeOrigin: true
  }
}
```

#### Button Loading State Stuck
**Error**: Buttons remain in loading state after navigation

**Solution**: Added `pageshow` event handler in `frontend/index.html` to force page reload on browser back navigation.

#### CUDA Dependencies in Container
**Error**: Container build fails with CUDA installation

**Solution**: Removed unused `openai-whisper` dependency that pulled in CUDA. Use `uv` for faster, cleaner dependency management.

#### Chart Visualization Issues
**Error**: Interview status charts don't display full circles

**Solution**: Filter chart data to only include valid status values before rendering.

### Container Management

```bash
# View logs
docker logs -f minimalagent-api-1
docker logs -f minimalagent-background-evaluator-1

# Restart services
docker compose restart

# Rebuild after code changes
docker compose up --build -d

# Clean rebuild
docker compose down
docker compose up --build -d
```

### Development Workflow

1. **Frontend changes**: `cd frontend && npm run build` then `docker compose up --build -d`
2. **Backend changes**: `docker compose up --build -d`
3. **Environment variables**: Copy `.env.example` to `.env` and configure API keys

## �📝 License

This project is licensed under the MIT License - see the LICENSE file for details.

## 🆘 Support

- **Documentation**: Start with:
  - `docs/config.md` – environment variables, Supabase secrets, and worker setup
  - `docs/pipeline.mc` – end-to-end backend + Supabase pipeline walkthrough
  - `docs/APIs.md` – live API surface and edge functions
  - `docs/queries.md` – database operations grouped by pipeline stage
  - `docs/supabase_tables.md` – current schema and normalization roadmap
- **Issues**: Report bugs and request features on GitHub
- **Discussions**: Join community discussions for questions

---

**Built with**: FastAPI, React, Supabase, Pipecat AI, Daily.co, Docker
