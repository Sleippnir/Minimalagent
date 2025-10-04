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
    "candidate_name": "Marco Pantalone",
    "job_title": "Data Scientist",
    "job_description": "Full job description text...",
    "resume_text": "Parsed resume content...",
    "questions": [
      {
        "text": "Question text...",
        "position": 1
      }
    ],
    "interviewer_prompt": "Complete interviewer prompt text..."
  },
  "bot_launched": false
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

## Data Access Patterns

### FastAPI Endpoints

- **Interview Management**: Scheduling, payload retrieval, transcript submission
- **Bot Integration**: Launching interview sessions

### Direct Supabase Access

- **Evaluation Results**: Frontend queries `evaluations` table directly
- **Real-time Updates**: Subscribe to interview status changes
- **User Authentication**: Supabase Auth for secure access

## Evaluation Results Access

Evaluation results are stored in the `evaluations` table and accessed directly via Supabase:

```javascript
// Query evaluations for a specific interview
const { data: evaluations } = await supabase
  .from('evaluations')
  .select('*')
  .eq('interview_id', interviewId);

// Subscribe to status changes
const channel = supabase
  .channel('interview-updates')
  .on('postgres_changes', {
    event: 'UPDATE',
    schema: 'public',
    table: 'interviews',
    filter: `interview_id=eq.${interviewId}`
  }, (payload) => {
    console.log('Interview status updated:', payload.new.status);
  })
  .subscribe();
```

### Evaluation Data Structure

```typescript
interface Evaluation {
  evaluation_id: string;
  interview_id: string;
  evaluator_llm_model: string; // 'gpt-4o', 'gemini-2.5-flash', 'deepseek-chat'
  score?: number; // 0-10 scale
  reasoning: string;
  raw_llm_response: any;
  created_at: string;
}
```

### Interview Payload Structure

The payload returned by `/interviews/{jwt_token}` contains:

- **interview_id**: Unique identifier for the interview
- **candidate_name**: Full name of the candidate
- **job_title**: Title of the position being interviewed for
- **job_description**: Complete job description text
- **resume_text**: Parsed and extracted resume content
- **questions**: Array of interview questions with position numbers
- **interviewer_prompt**: Complete prompt text for guiding the interview bot

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
