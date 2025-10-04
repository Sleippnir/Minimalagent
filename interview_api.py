"""
Interview API Server
Provides endpoints for interview management and transcript submission
"""

from fastapi import FastAPI, HTTPException, Depends
from fastapi.middleware.cors import CORSMiddleware
from pydantic import BaseModel
from typing import List, Dict, Any, Optional
import uvicorn
import logging
from interview import InterviewConfig, ContextService

logger = logging.getLogger(__name__)

app = FastAPI(title="Interview API", version="1.0.0")

# CORS middleware
app.add_middleware(
    CORSMiddleware,
    allow_origins=["*"],  # Configure appropriately for production
    allow_credentials=True,
    allow_methods=["*"],
    allow_headers=["*"],
)

# Initialize services lazily
interview_config = None
context_service = None

def get_context_service():
    global context_service
    if context_service is None:
        context_service = ContextService()
    return context_service

async def launch_interview_bot(room_url: str, interview_id: str) -> bool:
    """
    Launch an interview bot for the given room URL.
    Returns True if bot was launched successfully, False otherwise.
    """
    try:
        # Import here to avoid circular imports
        import subprocess
        import sys
        import os

        # Determine which bot to launch based on interview configuration
        # For now, default to simlibot.py - this could be made configurable
        bot_script = "interview/bots/simlibot.py"

        # Ensure the bot script exists
        if not os.path.exists(bot_script):
            logger.error(f"Bot script not found: {bot_script}")
            return False

        # For WebRTC transport, we don't need a room URL
        # Just pass the auth_token as an environment variable
        auth_token = room_url.split('/')[-1] if room_url else interview_id

        # Launch the bot as a subprocess with WebRTC transport
        env = os.environ.copy()
        env["AUTH_TOKEN"] = auth_token
        env["TRANSPORT"] = "webrtc"  # Force WebRTC transport

        logger.info(f"Launching bot {bot_script} for interview {interview_id} with auth_token: {auth_token}")

        # Launch the bot in the background
        # Use WebRTC transport which runs on port 7860
        try:
            process = subprocess.Popen(
                [sys.executable, bot_script],
                env=env,
                stdout=subprocess.PIPE,
                stderr=subprocess.PIPE,
                cwd=os.getcwd()
            )

            # Wait a moment to see if it starts successfully
            import time
            time.sleep(2)

            # Check if process is still running
            if process.poll() is None:
                logger.info(f"Bot launched successfully with PID: {process.pid}")
                return True
            else:
                # Process exited, get the error
                stdout, stderr = process.communicate()
                logger.error(f"Bot process exited immediately. STDOUT: {stdout.decode()}, STDERR: {stderr.decode()}")
                return False

        except Exception as e:
            logger.error(f"Failed to start bot process: {str(e)}")
            return False

    except Exception as e:
        logger.error(f"Failed to launch interview bot: {str(e)}")
        return False

# Pydantic models
class TranscriptTurn(BaseModel):
    speaker: str
    text: str
    timestamp: Optional[float] = None

class TranscriptSubmission(BaseModel):
    turns: List[TranscriptTurn]

@app.get("/health")
async def health_check():
    """Health check endpoint"""
    return {"status": "healthy", "service": "interview-api"}

@app.get("/interviews/{jwt_token}")
async def get_interview_payload(jwt_token: str, launch_bot: bool = False):
    """
    Get interviewer payload for a given JWT token

    This endpoint:
    1. Receives the JWT token from the URL path
    2. Queries the interviewer_queue table for the payload
    3. Optionally launches a bot for the interview
    4. Returns the complete interviewer payload
    """
    try:
        # Get interview context from queue
        context_service = get_context_service()
        payload = await context_service.get_interview_context(jwt_token)

        if not payload:
            raise HTTPException(status_code=404, detail="Interview not found or token expired")

        # Optionally launch bot
        if launch_bot:
            try:
                success = await launch_interview_bot(jwt_token, payload.get('interview_id', jwt_token))
                if success:
                    logger.info(f"Bot launched for interview {jwt_token}")
                else:
                    logger.error(f"Failed to launch bot for interview {jwt_token}")
            except Exception as e:
                logger.error(f"Failed to launch bot for interview {jwt_token}: {e}")
                # Don't fail the request if bot launch fails

        return {
            "status": "success",
            "payload": payload,
            "bot_launched": launch_bot
        }

    except Exception as e:
        raise HTTPException(status_code=500, detail=f"Error retrieving interview payload: {str(e)}")

@app.post("/interviews/{interview_id}/transcript")
async def submit_transcript(interview_id: str, transcript: TranscriptSubmission):
    """
    Submit interview transcript

    This endpoint:
    1. Receives the interview_id and transcript data
    2. Processes the transcript JSON to create full_text
    3. Saves transcript to database
    4. Updates interview status to 'completed' (triggers evaluation)
    """
    try:
        # Generate full text from transcript turns
        full_text = "\n".join([
            f"{turn.speaker}: {turn.text}"
            for turn in transcript.turns
        ])

        # Save transcript
        transcript_data = {
            "interview_id": interview_id,
            "transcript_json": transcript.turns,
            "full_text": full_text
        }

        context_service = get_context_service()
        success = await context_service.save_transcript(interview_id, transcript_data)

        if not success:
            raise HTTPException(status_code=500, detail="Failed to save transcript")

        return {
            "status": "success",
            "message": "Transcript submitted successfully. Evaluation will be triggered automatically.",
            "interview_id": interview_id
        }

    except Exception as e:
        raise HTTPException(status_code=500, detail=f"Error submitting transcript: {str(e)}")

if __name__ == "__main__":
    uvicorn.run(app, host="0.0.0.0", port=8000)