# Frontend Architecture & Development Guide

## Overview

The interview system frontend is currently served by an Nginx container that provides both static file serving and API proxying to the backend FastAPI service. This setup enables a clean separation between frontend presentation and backend business logic.

## Current Architecture

### Services

- **Frontend Service** (Port 8080): Nginx container serving static HTML/CSS/JS and proxying API calls
- **API Service** (Port 8001): FastAPI server handling interview management and bot launching
- **Database**: Supabase for interview data and user management

### File Structure

```text
frontend/
├── nginx.conf                 # Nginx configuration with API proxying
├── interview_creation_test.html  # Current test interface (admin/orchestrator)
├── API_DOCUMENTATION.md       # Backend API endpoint documentation
├── PIPELINE_DOCUMENTATION.md  # Interview flow and pipeline documentation
└── index.ts                   # TypeScript definitions (future use)
```

## Current Test Interface

The `interview_creation_test.html` file provides an admin interface for:

1. **Supabase Configuration**: Connect to Supabase project
2. **Application Creation**: Select candidates and jobs, create applications
3. **Question Curation**: Load and select interview questions
4. **Interview Scheduling**: Invoke Supabase Edge Functions to schedule interviews

### Key Features

- **Real-time Logging**: Activity log showing all operations
- **Supabase Integration**: Direct database operations for interview setup
- **Edge Function Calls**: Triggers interview scheduling via Supabase functions

## API Integration

### Base URLs

- **Direct API**: `http://localhost:8001` (for development/testing)
- **Proxied API**: `http://localhost:8080/api` (production - through nginx)

### Available Endpoints

#### Health Check

```javascript
GET /api/health
// Response: {"status": "healthy", "service": "interview-api"}
```

#### Interview Retrieval

```javascript
GET /api/interviews/{jwt_token}?launch_bot=false
// Retrieves interview context without launching bot
```

#### Interview with Bot Launch

```javascript
GET /api/interviews/{jwt_token}?launch_bot=true
// Retrieves interview context AND launches WebRTC bot
```

#### Transcript Submission

```javascript
POST /api/interviews/{interview_id}/transcript
// Submits completed interview transcript for evaluation
```

## Interview Flow

### 1. Admin Setup (Current Test Interface)

- Admin uses `interview_creation_test.html` to create interviews
- Data stored in Supabase `interviewer_queue` table
- JWT tokens generated for secure access

### 2. Candidate Experience (To Be Built)

- Candidate receives magic link: `https://yourdomain.com/interview/{jwt_token}`
- Frontend loads interview context via API
- Video call initializes with Daily.co
- AI interviewer bot joins automatically

### 3. Interview Session

- Real-time video/audio via WebRTC
- AI interviewer asks questions from curated list
- Responses recorded and transcribed

### 4. Post-Interview

- Transcript submitted to API for evaluation
- Automated scoring using LLM evaluation
- Results stored in Supabase

## Building the Actual Frontend

### Recommended Tech Stack

- **Framework**: React/Next.js or Vue.js/Nuxt.js
- **Styling**: Tailwind CSS (already used in test interface)
- **Video**: Daily.co React SDK or WebRTC API
- **State Management**: Zustand or Redux Toolkit
- **Routing**: Next.js routing or React Router

### Key Components Needed

#### 1. Interview Lobby Page

```text
URL: /interview/{jwt_token}
- Load interview context from API
- Display candidate/job information
- Initialize video call setup
- Show interview instructions
```

#### 2. Video Interview Component

```text
- Daily.co room integration
- Local video/audio controls
- Bot status indicators
- Real-time transcription display
```

#### 3. Admin Dashboard (Replace Test Interface)

```text
- Interview management
- Candidate/job selection
- Question curation interface
- Scheduling controls
```

#### 4. Results/Dashboard

```text
- Interview results viewing
- Evaluation scores
- Transcript review
```

### API Integration Patterns

#### Loading Interview Context

```javascript
const loadInterview = async (jwtToken) => {
  try {
    const response = await fetch(`/api/interviews/${jwtToken}`);
    const data = await response.json();

    if (data.status === 'success') {
      // Initialize interview with payload
      const { candidate, job, questions } = data.payload;
      // Set up video call, etc.
    }
  } catch (error) {
    console.error('Failed to load interview:', error);
  }
};
```

#### Launching Interview with Bot

```javascript
const startInterview = async (jwtToken) => {
  try {
    const response = await fetch(`/api/interviews/${jwtToken}?launch_bot=true`);
    const data = await response.json();

    if (data.bot_launched) {
      // Bot is joining the call
      // Initialize Daily.co room
    }
  } catch (error) {
    console.error('Failed to start interview:', error);
  }
};
```

#### Submitting Transcript

```javascript
const submitTranscript = async (interviewId, transcript) => {
  try {
    const response = await fetch(`/api/interviews/${interviewId}/transcript`, {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({ turns: transcript })
    });

    const result = await response.json();
    // Handle evaluation results
  } catch (error) {
    console.error('Failed to submit transcript:', error);
  }
};
```

## Development Setup

### Local Development

1. **Start services**: `docker-compose up -d`
2. **Access frontend**: `http://localhost:8080`
3. **API proxy**: All `/api/*` calls automatically proxied to backend

### Building Production Frontend

1. **Replace static HTML** with your framework build output
2. **Update nginx.conf** to serve your built assets
3. **Maintain API proxy** configuration for backend communication

### Nginx Configuration Notes

- Static files served from `/usr/share/nginx/html`
- API routes proxied to `http://api:8001`
- CORS headers configured for cross-origin requests
- Supports preflight OPTIONS requests

## Migration Path

### Phase 1: Replace Test Interface

- Build admin dashboard component
- Migrate Supabase operations to new interface
- Maintain existing API integration

### Phase 2: Candidate Experience

- Create interview lobby page
- Implement video call component
- Add real-time features

### Phase 3: Enhanced Features

- Add authentication/authorization
- Implement user roles (admin/candidate)
- Add analytics and reporting

## Testing

### Current Test Commands

```bash
# Health checks
curl http://localhost:8001/health
curl http://localhost:8080/api/health

# Test interview retrieval
curl "http://localhost:8080/api/interviews/test_token?launch_bot=false"
```

### Frontend Testing Checklist

- [ ] Admin can create interviews via new interface
- [ ] Candidates can access interview lobby
- [ ] Video calls initialize correctly
- [ ] Bot launches and joins calls
- [ ] Transcripts submit successfully
- [ ] Evaluations generate properly

## Next Steps

1. **Choose Framework**: Decide on React/Next.js vs Vue/Nuxt
2. **Set Up Project**: Initialize new frontend project
3. **Implement Admin Dashboard**: Replace test interface functionality
4. **Build Interview Flow**: Create candidate experience
5. **Test Integration**: Ensure all API calls work through nginx proxy
6. **Deploy**: Update Docker setup for production frontend

This documentation provides the foundation for building a complete, production-ready interview frontend that integrates seamlessly with the existing API and bot infrastructure.




