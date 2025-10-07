# Frontend Architecture & Development Guide

## Overview

The interview system frontend is a modern React 18 application built with Vite, featuring HR dashboards and candidate portals. The production setup uses Nginx for static file serving with API proxying to the FastAPI backend.

## Current Architecture

### Technology Stack

- **React 18** with modern hooks and functional components
- **Vite** for fast development and optimized production builds
- **Tailwind CSS** for responsive styling and design system
- **React Router** for client-side navigation
- **Fetch API** for API communication

### Services

- **Frontend Service** (Port 8080): Nginx container serving React SPA and proxying API calls
- **Development Server** (Port 5173): Vite dev server with hot reload and API proxying
- **API Service** (Port 8001): FastAPI server handling interview management and bot launching
- **Database**: Supabase for interview data and user management

### File Structure

```text
frontend/
├── src/
│   ├── App.jsx                 # Main application component
│   ├── main-candidate.jsx      # Candidate portal entry point
│   ├── components/             # Reusable React components
│   ├── pages/                  # Page-level components
│   └── index.css               # Global styles and Tailwind imports
├── public/                     # Static assets
├── package.json                # Dependencies and scripts
├── vite.config.js              # Vite configuration with API proxying
├── tailwind.config.js          # Tailwind CSS configuration
└── nginx.conf                  # Production Nginx configuration
```

## Development Setup

### Prerequisites

- Node.js 18+
- npm or yarn

### Installation

```bash
cd frontend
npm install
```

### Development Server

```bash
npm run dev
```

This starts the Vite development server on `http://localhost:5173` with:
- Hot module replacement
- API proxying to `http://localhost:8001`
- Automatic browser refresh on changes

### Production Build

```bash
npm run build
```

This creates optimized production assets in the `dist/` directory, served by Nginx in production.

## Application Structure

### HR Dashboard (`/dashboards/hr/`)

The main HR interface provides:
- Interview creation and management
- Candidate tracking and status updates
- Analytics and reporting dashboards
- Real-time interview monitoring

### Candidate Portal (`/candidate`)

The candidate-facing interface for:
- Interview scheduling and confirmation
- Pre-interview preparation
- Video call access with Daily.co integration
- Post-interview feedback

## API Integration

### Base URLs

- **Development**: `http://localhost:5173/api` (proxied to `http://localhost:8001`)
- **Production**: `http://localhost:8080/api` (proxied through Nginx to API container)

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

### 1. Admin Setup (HR Dashboard)

- HR users access the React dashboard at `http://localhost:8080/dashboards/hr/`
- Create interviews through the web interface
- Data stored in Supabase `interviewer_queue` table
- JWT tokens generated for secure candidate access

### 2. Candidate Experience (React Portal)

- Candidate receives magic link: `https://yourdomain.com/candidate/{jwt_token}`
- React application loads interview context via API
- Video call initializes with Daily.co WebRTC
- AI interviewer bot joins automatically

### 3. Interview Session

- Real-time video/audio via WebRTC (Daily.co)
- AI interviewer asks questions from curated list
- Responses recorded and transcribed automatically
- Interview bot accessible at `http://localhost:7861/client`

### 4. Post-Interview Processing

- Transcripts submitted to API for evaluation
- Multi-LLM evaluation runs in background
- Results available in HR dashboard
- Candidate receives feedback via email/magic link

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




