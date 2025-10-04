# Interview Pipeline Documentation

## Interview Pipeline Flow

### **Phase 1: Interview Setup & Invitation**

1. **Interview Creation** (Admin/Orchestrator)
   - Admin creates application via `interview_creation_test.html` or API
   - System generates JWT token and stores interview context in `interviewer_queue` table
   - Magic link is sent to candidate: `https://frontend-domain.com/interview/{jwt_token}`

### **Phase 2: Candidate Access**

2. **Candidate Clicks Magic Link**
   - Browser navigates to frontend with JWT token in URL
   - Frontend extracts `jwt_token` from URL path

3. **Frontend Loads Interview Context**
   - Frontend calls `GET /interviews/{jwt_token}`
   - `interview_api.py` receives request
   - API calls `context_service.get_interview_context(jwt_token)`
   - Service queries `interviewer_queue` table for payload
   - Returns interview data:
     ```json
     {
       "interview_id": "uuid",
       "candidate": {"first_name": "Candidate", "last_name": "A"},
       "job": {"title": "UI/UX Designer", "description": "..."},
       "questions": [...],
       "interviewer_prompt": "Custom AI interviewer instructions...",
       "evaluation_materials": {...}
     }
     ```

### **Phase 3: Video Interview Session**

4. **Frontend Initializes Video Call**
   - Creates Daily.co room with room name = `jwt_token`
   - Room URL: `https://domain.daily.co/{jwt_token}`
   - Starts video/audio capture

5. **Bot Service Starts**
   - Pipecat runner launches bot (e.g., `videobot2.py`)
   - Bot extracts `auth_token` from `transport.room_url.split('/')[-1]`
   - Bot calls `queue_service.get_interview_context_from_queue(auth_token)`
   - Loads same interview context from `interviewer_queue`

6. **Interview Begins**
   - Bot uses `interviewer_prompt` as system message for LLM
   - AI interviewer greets candidate and starts asking questions
   - Conversation flows with context management tools:
     - `clean_context_and_summarize` - manages conversation history
     - `end_conversation` - terminates session

### **Phase 4: Interview Completion**

7. **Transcript Generation**
   - `TranscriptProcessor` captures all speech-to-text
   - Bot saves transcript to `interview_transcripts` table:
     ```json
     {
       "interview_id": "uuid",
       "full_text": "Interviewer: ... Candidate: ...",
       "transcript_json": [...],
       "status": "completed"
     }
     ```

8. **Interview Status Update**
   - Interview record moved from `interviewer_queue` to `evaluator_queue`
   - Triggers background evaluation process

### **Phase 5: AI Evaluation**

9. **Background Evaluator Activates**
   - `background_evaluator.py` polls `evaluator_queue` every 30 seconds
   - Finds completed interview with transcript
   - Loads interview context + transcript data

10. **Multi-LLM Evaluation**
    - `EvaluationHelper` processes transcript with 3 LLMs:
      - **OpenAI GPT-4o**: Technical/behavioral scoring
      - **Google Gemini-2.5-flash**: Alternative perspective
      - **DeepSeek (OpenRouter)**: Additional evaluation
    - Each LLM evaluates against rubric criteria
    - Generates structured feedback

11. **Results Storage**
    - Evaluations saved to `evaluations` table:
      ```json
      {
        "interview_id": "uuid",
        "provider": "openai/gpt-4o",
        "overall_score": 2.7,
        "recommendation": "No",
        "technical_feedback": "...",
        "behavioral_feedback": "...",
        "rubric_scores": {...}
      }
      ```

### **Phase 6: Results Access**

12. **Admin/HR Review**
    - Evaluations accessible via Supabase dashboard
    - Multiple LLM perspectives provide comprehensive assessment
    - Automated scoring + qualitative feedback

## Key Integration Points

- **Database**: Supabase PostgreSQL with tables:
  - `interviewer_queue` - Active interviews
  - `evaluator_queue` - Completed interviews awaiting evaluation
  - `interview_transcripts` - Raw conversation data
  - `evaluations` - AI-generated assessments

- **Real-time Communication**: Daily.co WebRTC for video/audio
- **AI Services**: Multiple LLM providers for robust evaluation
- **Context Management**: JWT tokens ensure secure, contextual interviews

The pipeline ensures end-to-end automation from candidate invitation through final evaluation, with proper context preservation and multi-perspective AI assessment.
