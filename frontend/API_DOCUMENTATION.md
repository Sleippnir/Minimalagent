# Interview API Documentation

The interview system uses a FastAPI server running on port 8000. Here are the relevant endpoints:

## Base URL

```
http://localhost:8000
```

## Endpoints

### 1. Health Check

**GET** `/health`

**Purpose**: Check if the API server is running.

**Response**:

```json
{
  "status": "healthy",
  "service": "interview-api"
}
```

### 2. Get Interview Payload

**GET** `/interviews/{jwt_token}`

**Purpose**: Retrieve the complete interview context and configuration for a candidate.

**Parameters**:

- `jwt_token` (path): The JWT authentication token for the interview session

**Response** (Success):

```json
{
  "status": "success",
  "payload": {
    "interview_id": "uuid",
    "auth_token": "jwt-token",
    "candidate": {
      "first_name": "Candidate",
      "last_name": "A"
    },
    "job": {
      "title": "UI/UX Designer",
      "description": "Job description text..."
    },
    "rubric": {
      "technical_criteria": [...],
      "behavioral_criteria": [...]
    },
    "evaluation_materials": {
      "resume_text": "parsed resume content...",
      "job_description": "full job description..."
    },
    "transcript": null,
    "questions": [
      {
        "id": "uuid",
        "type": "technical",
        "question": "Question text...",
        "answer": null
      }
    ],
    "status": "in_progress"
  }
}
```

**Response** (Error):

```json
{
  "detail": "Interview not found or token expired"
}
```

### 3. Submit Interview Transcript

**POST** `/interviews/{interview_id}/transcript`

**Purpose**: Submit the completed interview transcript and trigger automatic evaluation.

**Parameters**:

- `interview_id` (path): The unique identifier for the interview

**Request Body**:

```json
{
  "turns": [
    {
      "speaker": "interviewer",
      "text": "Tell me about your experience with React.",
      "timestamp": 1640995200.0
    },
    {
      "speaker": "candidate",
      "text": "I've been working with React for 3 years...",
      "timestamp": 1640995210.0
    }
  ]
}
```

**Response** (Success):

```json
{
  "status": "success",
  "message": "Transcript submitted successfully. Evaluation will be triggered automatically.",
  "interview_id": "uuid"
}
```

**Response** (Error):

```json
{
  "detail": "Error submitting transcript: [error message]"
}
```

## Data Structures

### TranscriptTurn

```typescript
interface TranscriptTurn {
  speaker: string;        // "interviewer" or "candidate"
  text: string;          // The spoken text
  timestamp?: number;    // Optional Unix timestamp
}
```

### Interview Payload Structure

The payload returned by `/interviews/{jwt_token}` contains:

- **interview_id**: Unique identifier for the interview
- **auth_token**: JWT token for authentication
- **candidate**: Anonymized candidate info (always "Candidate A" for bias reduction)
- **job**: Job title and description
- **rubric**: Evaluation criteria (technical and behavioral)
- **evaluation_materials**: Resume text and job description for LLM evaluation
- **transcript**: Initially null, populated after submission
- **questions**: Array of interview questions with answers
- **status**: Interview status ("in_progress", "completed", etc.)

## Frontend Integration Notes

1. **CORS**: The API has CORS enabled for all origins (`*`), so you can make requests from your frontend.

2. **Authentication**: Use the JWT token from the URL path for the interview session.

3. **Flow**:
   - Load interview data using `/interviews/{jwt_token}`
   - Display questions and record transcript
   - Submit transcript via `/interviews/{interview_id}/transcript`
   - Evaluation happens automatically in the background

4. **Error Handling**: Check for HTTP status codes and error messages in the response.

5. **Real-time Updates**: The system uses Supabase for real-time database updates. You may want to subscribe to changes in the interview status.

## Development Setup

To run the API server:

```bash
python interview_api.py
```

The server will start on `http://localhost:8000`.

## Testing

You can test the API using the existing test files:

- `test_api.py` - Basic API connectivity test
- `interview_creation_test.html` - Full interview creation flow test

The system integrates with Supabase for data persistence and uses background evaluators that automatically process transcripts with multiple LLM providers (OpenAI GPT-4, Google Gemini, DeepSeek) once submitted.
