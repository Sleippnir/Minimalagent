"""
Interview API Server
Provides endpoints for interview management and transcript submission
"""

from fastapi import FastAPI, HTTPException, Depends
from fastapi.middleware.cors import CORSMiddleware
from pydantic import BaseModel
from typing import List, Dict, Any, Optional, Tuple
import uvicorn
import logging
import asyncio
import signal
import os
from datetime import datetime, timedelta, timezone
from contextlib import asynccontextmanager
from interview import InterviewConfig, ContextService
import json

logger = logging.getLogger(__name__)

# Global bot process tracking
bot_processes: Dict[
    str, Dict[str, Any]
] = {}  # interview_id -> {"pid": int, "start_time": datetime, "cleanup_scheduled": bool}


@asynccontextmanager
async def lifespan(app: FastAPI):
    """Handle application startup and shutdown events"""
    # Startup
    logger.info("Starting bot process cleanup background task")
    asyncio.create_task(cleanup_completed_bot_processes())

    yield

    # Shutdown (if needed)
    pass


app = FastAPI(title="Interview API", version="1.0.0", lifespan=lifespan)

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


async def create_daily_room() -> Dict[str, str]:
    """Create a Daily room and meeting token."""
    import uuid
    import httpx

    api_key = os.getenv("DAILY_API_KEY")
    daily_domain = os.getenv("DAILY_DOMAIN")

    if not api_key or not daily_domain:
        raise RuntimeError(
            "Daily configuration missing. DAILY_API_KEY and DAILY_DOMAIN are required."
        )

    room_name = f"interview-{uuid.uuid4().hex[:10]}"
    headers = {"Authorization": f"Bearer {api_key}"}
    api_url = os.getenv("DAILY_API_URL", "https://api.daily.co/v1")
    expiration_dt = datetime.now(timezone.utc) + timedelta(hours=2)
    expiration = int(expiration_dt.timestamp())

    async with httpx.AsyncClient(timeout=10.0) as client:
        room_payload = {
            "name": room_name,
            "properties": {
                "exp": expiration,
                "eject_at_room_exp": True,
            },
        }
        room_resp = await client.post(
            f"{api_url}/rooms", headers=headers, json=room_payload
        )
        room_resp.raise_for_status()

        token_payload = {
            "properties": {"room_name": room_name, "is_owner": False, "exp": expiration}
        }
        token_resp = await client.post(
            f"{api_url}/meeting-tokens", headers=headers, json=token_payload
        )
        token_resp.raise_for_status()

        room_url = f"https://{daily_domain}.daily.co/{room_name}"
        meeting_token = token_resp.json().get("token", "")

    return {"room_url": room_url, "room_token": meeting_token}


async def launch_interview_bot(
    auth_token: str,
    interview_id: str,
    *,
    transport: Optional[str] = None,
    room_info: Optional[Dict[str, str]] = None,
) -> Tuple[bool, Optional[Dict[str, str]]]:
    """
    Launch an interview bot for the given auth token.
    Returns (success flag, room info) - room info is present for Daily transport.
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
            return False, room_info

        transport = transport or os.getenv("PIPECAT_TRANSPORT", "daily")

        # Launch the bot as a subprocess with desired transport
        env = os.environ.copy()
        env["AUTH_TOKEN"] = auth_token
        env["TRANSPORT"] = transport

        logger.info(
            f"Launching bot {bot_script} for interview {interview_id} with auth_token: {auth_token}"
        )

        if transport == "daily":
            if room_info is None:
                room_info = await create_daily_room()
            env["DAILY_ROOM_URL"] = room_info["room_url"]
            env["DAILY_ROOM_TOKEN"] = room_info.get("room_token", "")
            env["BOT_MODE"] = "standalone"
            launch_command = [
                sys.executable,
                "-m",
                bot_script.replace("/", ".").replace(".py", ""),
            ]
        else:
            # WebRTC fallback (local testing)
            env["PORT"] = "7861"
            env["PIPECAT_PORT"] = "7861"
            env["HOST"] = "0.0.0.0"
            launch_command = [
                sys.executable,
                "-m",
                bot_script.replace("/", ".").replace(".py", ""),
                "--host",
                "0.0.0.0",
                "--port",
                "7861",
            ]

        # Launch the bot in the background
        try:
            # Convert script path to module format for proper relative imports
            module_path = bot_script.replace("/", ".").replace(".py", "")
            process = subprocess.Popen(
                launch_command,
                env=env,
                # Remove stdout/stderr pipes to show logs in main terminal
                cwd=os.getcwd(),
            )

            # Wait a moment to see if it starts successfully
            import time

            time.sleep(2)

            # Check if process is still running
            if process.poll() is None:
                logger.info(f"Bot launched successfully with PID: {process.pid}")
                # Track the bot process for cleanup
                bot_processes[interview_id] = {
                    "pid": process.pid,
                    "auth_token": auth_token,
                    "transport": transport,
                    "room_url": room_info["room_url"] if room_info else None,
                    "start_time": datetime.now(),
                    "cleanup_scheduled": False,
                }
                logger.info(
                    f"Tracking bot process {process.pid} for interview {interview_id}"
                )
                return True, room_info if transport == "daily" else None
            else:
                # Process exited, get the error
                stdout, stderr = process.communicate()
                logger.error(
                    f"Bot process exited immediately. STDOUT: {stdout.decode()}, STDERR: {stderr.decode()}"
                )
                return False, None

        except Exception as e:
            logger.error(f"Failed to start bot process: {str(e)}")
            return False, None

    except Exception as e:
        logger.error(f"Failed to launch interview bot: {str(e)}")
        return False, None


async def cleanup_completed_bot_processes():
    """
    Background task that monitors for completed interviews and cleans up their bot processes.
    Runs every 30 seconds to check for interviews that have completed.
    """
    while True:
        try:
            # Check each tracked bot process
            interviews_to_cleanup = []
            for interview_id, process_info in bot_processes.items():
                try:
                    # Check if interview is completed by querying the database
                    ctx_service = get_context_service()

                    # Try to get interview context - if it fails or status is 'completed', clean up
                    try:
                        interview_context = await ctx_service.get_interview_context(
                            process_info.get("auth_token", interview_id), use_cache=False
                        )
                        if (
                            interview_context
                            and interview_context.get("status") == "completed"
                        ):
                            logger.info(
                                f"Interview {interview_id} marked as completed in database, scheduling bot cleanup"
                            )
                            await terminate_bot_process(interview_id)
                            continue
                    except Exception:
                        # If we can't get context, assume interview might be completed
                        pass

                    # Check if process is still running
                    pid = process_info["pid"]
                    try:
                        os.kill(pid, 0)  # Signal 0 just checks if process exists
                        process_still_running = True
                    except OSError:
                        process_still_running = False

                    if not process_still_running:
                        # Process has exited naturally
                        logger.info(
                            f"Bot process {pid} for interview {interview_id} has exited naturally"
                        )
                        interviews_to_cleanup.append(interview_id)

                    else:
                        # Process is still running, check for timeout
                        elapsed = datetime.now() - process_info["start_time"]
                        if elapsed > timedelta(
                            hours=2
                        ):  # Assume interviews don't run longer than 2 hours
                            logger.warning(
                                f"Bot process {pid} for interview {interview_id} has been running for {elapsed}, terminating"
                            )
                            await terminate_bot_process(interview_id)

                except Exception as e:
                    logger.error(
                        f"Error checking bot process for interview {interview_id}: {e}"
                    )

            # Clean up completed interviews from tracking
            for interview_id in interviews_to_cleanup:
                if interview_id in bot_processes:
                    del bot_processes[interview_id]
                    logger.info(
                        f"Removed completed interview {interview_id} from tracking"
                    )

        except Exception as e:
            logger.error(f"Error in bot process cleanup task: {e}")

        # Wait 30 seconds before next check
        await asyncio.sleep(30)


async def terminate_bot_process(interview_id: str):
    """
    Terminate a bot process with a 60-second grace period for graceful shutdown.
    """
    if interview_id not in bot_processes:
        logger.warning(f"No tracked process found for interview {interview_id}")
        return

    process_info = bot_processes[interview_id]
    pid = process_info["pid"]

    logger.info(
        f"Scheduling termination of bot process {pid} for interview {interview_id} in 60 seconds"
    )

    # Wait 60 seconds for graceful shutdown
    await asyncio.sleep(60)

    try:
        # Check if process still exists
        os.kill(pid, 0)
        logger.info(f"Terminating bot process {pid} for interview {interview_id}")

        # Send SIGTERM first for graceful shutdown
        os.kill(pid, signal.SIGTERM)

        # Wait a bit for graceful shutdown
        await asyncio.sleep(5)

        # If still running, force kill
        try:
            os.kill(pid, 0)  # Check if still running
            logger.warning(
                f"Force killing bot process {pid} for interview {interview_id}"
            )
            os.kill(pid, signal.SIGKILL)
        except OSError:
            pass  # Process already terminated

    except OSError:
        logger.info(
            f"Bot process {pid} for interview {interview_id} already terminated"
        )
    except Exception as e:
        logger.error(
            f"Error terminating bot process {pid} for interview {interview_id}: {e}"
        )
    finally:
        # Remove from tracking
        if interview_id in bot_processes:
            del bot_processes[interview_id]
            logger.info(f"Cleaned up tracking for interview {interview_id}")


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


@app.get("/admin/bot-processes")
async def get_bot_processes():
    """Get information about currently tracked bot processes (admin endpoint)"""
    return {
        "tracked_processes": len(bot_processes),
        "processes": [
            {
                "interview_id": interview_id,
                "pid": info["pid"],
                "start_time": info["start_time"].isoformat(),
                "runtime_seconds": (
                    datetime.now() - info["start_time"]
                ).total_seconds(),
            }
            for interview_id, info in bot_processes.items()
        ],
    }


@app.post("/admin/cleanup/{interview_id}")
async def manual_cleanup(interview_id: str):
    """Manually trigger cleanup for a specific interview's bot process (admin endpoint)"""
    if interview_id not in bot_processes:
        return {
            "status": "not_found",
            "message": f"No tracked process for interview {interview_id}",
        }

    logger.info(f"Manual cleanup triggered for interview {interview_id}")
    await terminate_bot_process(interview_id)

    return {"status": "cleanup_scheduled", "interview_id": interview_id}


@app.get("/interviews/{jwt_token}")
async def get_interview_payload(jwt_token: str, launch_bot: bool = False):
    """
    Get interviewer payload for a given JWT token

    This endpoint:
    1. Receives the JWT token from the URL path
    2. For test token "AnyoneAI", loads dummy payload directly
    3. Otherwise, queries the interviewer_queue table for the payload
    4. Optionally launches a bot for the interview
    5. Returns the complete interviewer payload
    """
    transport = os.getenv("PIPECAT_TRANSPORT", "daily")
    dummy_token = "AnyoneAI"

    payload = None
    try:
        context_service = get_context_service()
        payload = await context_service.get_interview_context(jwt_token)
    except Exception as exc:
        logger.warning(f"Unable to fetch payload for {jwt_token}: {exc}")

    if not payload and jwt_token != dummy_token:
        raise HTTPException(
            status_code=404, detail="Interview not found or token expired"
        )

    response: Dict[str, Any] = {
        "status": "success",
        "auth_token": jwt_token,
        "transport": transport,
        "bot_launched": False,
    }

    if payload:
        response["payload"] = payload

    room_details: Optional[Dict[str, str]] = None

    if launch_bot:
        try:
            initial_room = await create_daily_room() if transport == "daily" else None
            success, bot_room = await launch_interview_bot(
                auth_token=jwt_token,
                interview_id=(payload or {}).get("interview_id", jwt_token),
                transport=transport,
                room_info=initial_room,
            )
            response["bot_launched"] = success
            room_details = bot_room or initial_room
            if success:
                logger.info(f"Bot launched for interview {jwt_token}")
            else:
                logger.error(f"Failed to launch bot for interview {jwt_token}")
        except Exception as e:
            logger.error(f"Failed to launch bot for interview {jwt_token}: {e}")

    if room_details:
        response["room"] = room_details

    return response


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
        full_text = "\n".join(
            [f"{turn.speaker}: {turn.text}" for turn in transcript.turns]
        )

        # Save transcript
        transcript_data = {
            "interview_id": interview_id,
            "transcript_json": transcript.turns,
            "full_text": full_text,
        }

        context_service = get_context_service()
        success = await context_service.save_transcript(interview_id, transcript_data)

        if not success:
            raise HTTPException(status_code=500, detail="Failed to save transcript")

        return {
            "status": "success",
            "message": "Transcript submitted successfully. Evaluation will be triggered automatically.",
            "interview_id": interview_id,
        }

    except Exception as e:
        raise HTTPException(
            status_code=500, detail=f"Error submitting transcript: {str(e)}"
        )


# Content Management Endpoints
from scripts.content_manager import (
    ContentManager,
    validate_new_job_tags,
    validate_new_question_tags,
    ensure_job_question_consistency,
)

content_manager = ContentManager()


@app.post("/admin/content/validate-job-tags")
async def validate_job_tags_endpoint(title: str, description: str):
    """Validate tags for a new job posting (admin endpoint)"""
    try:
        tags = validate_new_job_tags(title, description)
        return {
            "status": "success",
            "tags": tags,
            "message": f"Generated {len(tags)} tags for job",
        }
    except Exception as e:
        raise HTTPException(
            status_code=500, detail=f"Error validating job tags: {str(e)}"
        )


@app.post("/admin/content/validate-question-tags")
async def validate_question_tags_endpoint(text: str, category: str):
    """Validate tags for a new question (admin endpoint)"""
    try:
        tags = validate_new_question_tags(text, category)
        return {
            "status": "success",
            "tags": tags,
            "message": f"Generated {len(tags)} tags for question",
        }
    except Exception as e:
        raise HTTPException(
            status_code=500, detail=f"Error validating question tags: {str(e)}"
        )


@app.post("/admin/content/fix-job/{job_id}")
async def fix_job_tags_endpoint(job_id: str):
    """Fix tags for an existing job (admin endpoint)"""
    try:
        result = content_manager.fix_job_tags(job_id)
        if result["updated"]:
            # Refresh relationships after fixing tags
            ensure_job_question_consistency(job_id)
            return {
                "status": "success",
                "message": "Job tags fixed and relationships updated",
                "old_tags": result["old_tags"],
                "new_tags": result["new_tags"],
            }
        else:
            return {"status": "no_change", "message": result["message"]}
    except Exception as e:
        raise HTTPException(status_code=500, detail=f"Error fixing job tags: {str(e)}")


@app.post("/admin/content/fix-question/{question_id}")
async def fix_question_tags_endpoint(question_id: str):
    """Fix tags for an existing question (admin endpoint)"""
    try:
        result = content_manager.fix_question_tags(question_id)
        return {
            "status": "success" if result["updated"] else "no_change",
            "message": "Question tags fixed"
            if result["updated"]
            else result["message"],
            "old_tags": result.get("old_tags", []),
            "new_tags": result.get("new_tags", []),
        }
    except Exception as e:
        raise HTTPException(
            status_code=500, detail=f"Error fixing question tags: {str(e)}"
        )


@app.get("/admin/content/audit")
async def audit_content_endpoint():
    """Run content consistency audit (admin endpoint)"""
    try:
        audit = content_manager.audit_content_consistency()
        return {"status": "success", "audit": audit}
    except Exception as e:
        raise HTTPException(status_code=500, detail=f"Error running audit: {str(e)}")


@app.post("/admin/content/bulk-fix")
async def bulk_fix_content_endpoint():
    """Fix all content consistency issues (admin endpoint)"""
    try:
        result = content_manager.bulk_fix_content()
        return {
            "status": "success",
            "message": "Bulk content fix completed",
            "results": result,
        }
    except Exception as e:
        raise HTTPException(status_code=500, detail=f"Error in bulk fix: {str(e)}")


@app.post("/admin/content/refresh-relationships/{job_id}")
async def refresh_job_relationships_endpoint(job_id: str):
    """Refresh question relationships for a specific job (admin endpoint)"""
    try:
        result = content_manager.refresh_job_relationships(job_id)
        return {
            "status": "success",
            "message": f"Refreshed {result['questions_added']} question relationships",
            "average_overlap": result["average_overlap"],
        }
    except Exception as e:
        raise HTTPException(
            status_code=500, detail=f"Error refreshing relationships: {str(e)}"
        )


if __name__ == "__main__":
    uvicorn.run(app, host="0.0.0.0", port=8000)
