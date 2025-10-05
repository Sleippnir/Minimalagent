import os

from dotenv import load_dotenv
from loguru import logger
from simli import SimliConfig
from datetime import datetime
from pathlib import Path

from pipecat.services.google.stt import GoogleSTTService, Language
from pipecat.services.elevenlabs.tts import ElevenLabsTTSService
from pipecat.services.google.llm import GoogleLLMService
from pipecat.audio.turn.smart_turn.base_smart_turn import SmartTurnParams
from pipecat.audio.turn.smart_turn.local_smart_turn_v3 import LocalSmartTurnAnalyzerV3
from pipecat.audio.vad.silero import SileroVADAnalyzer
from pipecat.audio.vad.vad_analyzer import VADParams
from pipecat.frames.frames import LLMRunFrame, StartFrame
from pipecat.pipeline.pipeline import Pipeline
from pipecat.pipeline.runner import PipelineRunner
from pipecat.pipeline.task import PipelineParams, PipelineTask
from pipecat.processors.aggregators.llm_context import LLMContext
from pipecat.processors.aggregators.llm_response_universal import LLMContextAggregatorPair
from pipecat.runner.types import RunnerArguments
from pipecat.runner.utils import create_transport
from pipecat.services.cartesia.tts import CartesiaTTSService
from pipecat.services.deepgram.stt import DeepgramSTTService, Language, LiveOptions
from pipecat.services.openai.llm import OpenAILLMService
from pipecat.services.simli.video import SimliVideoService
from pipecat.transports.base_transport import BaseTransport, TransportParams

# Try to import Daily transport, fallback to WebRTC only if not available
try:
    from pipecat.transports.daily.transport import DailyParams
    DAILY_AVAILABLE = True
except ImportError:
    DAILY_AVAILABLE = False
    DailyParams = None
from pipecat.frames.frames import EndFrame, EndTaskFrame, TTSSpeakFrame, TextFrame
from pipecat.processors.frame_processor import FrameDirection
from pipecat.services.llm_service import FunctionCallParams
from pipecat.adapters.schemas.tools_schema import ToolsSchema
from pipecat.adapters.schemas.function_schema import FunctionSchema
from pipecat.processors.transcript_processor import TranscriptProcessor

# Inline Supabase services to avoid import issues
import httpx
from typing import Optional, Dict, Any, List

class SupabaseClient:
    """Simple HTTP client for Supabase REST API"""

    def __init__(self):
        # Use environment variables directly
        supabase_url = os.getenv("SUPABASE_URL")
        supabase_key = os.getenv("SUPABASE_ANON_KEY")

        if not supabase_url or not supabase_key:
            raise ValueError("SUPABASE_URL and SUPABASE_ANON_KEY environment variables must be set")

        self.base_url = f"{supabase_url}/rest/v1"
        self.headers = {
            "apikey": supabase_key,
            "Authorization": f"Bearer {supabase_key}",
            "Content-Type": "application/json",
            "Prefer": "return=representation"
        }

    async def get(self, table: str, filters: Dict[str, str] = None) -> List[Dict[str, Any]]:
        """GET request to Supabase table"""
        url = f"{self.base_url}/{table}"
        params = {}

        if filters:
            for key, value in filters.items():
                params[key] = f"eq.{value}"

        async with httpx.AsyncClient() as client:
            response = await client.get(url, headers=self.headers, params=params)
            response.raise_for_status()
            return response.json()

    async def post(self, table: str, data: Dict[str, Any]) -> Dict[str, Any]:
        """POST request to create record"""
        url = f"{self.base_url}/{table}"

        async with httpx.AsyncClient() as client:
            response = await client.post(url, headers=self.headers, json=data)
            response.raise_for_status()
            result = response.json()
            return result[0] if isinstance(result, list) else result

    async def patch(self, table: str, filters: Dict[str, str], data: Dict[str, Any]) -> Dict[str, Any]:
        """PATCH request to update record"""
        url = f"{self.base_url}/{table}"
        params = {}

        for key, value in filters.items():
            params[key] = f"eq.{value}"

        async with httpx.AsyncClient() as client:
            response = await client.patch(url, headers=self.headers, params=params, json=data)
            response.raise_for_status()
            result = response.json()

            # PATCH might return empty array on successful update
            if isinstance(result, list):
                return result[0] if result else {"updated": True}
            else:
                return result

# Singleton instance
_client = None

def get_supabase_client() -> SupabaseClient:
    """Get singleton Supabase client"""
    global _client
    if _client is None:
        _client = SupabaseClient()
    return _client

class QueueService:
    """Service for retrieving formed JSON from queue tables via edge functions"""

    def __init__(self):
        self.client = get_supabase_client()

    async def get_interviewer_context(self, auth_token: str) -> Optional[Dict[str, Any]]:
        """Retrieve interviewer queue record by auth token"""
        try:
            results = await self.client.get("interviewer_queue", {"auth_token": auth_token})

            if results:
                return results[0]
            return None

        except Exception as e:
            print(f"Error getting interviewer context: {e}")
            return None

class TranscriptService:
    """Service for writing to transcripts table"""

    def __init__(self):
        self.client = get_supabase_client()

    async def write_transcript(self, interview_id: str, full_text: str, transcript_json: Dict[str, Any], audio_path: str = None) -> bool:
        """Write finalized interview to transcripts table AND update interviews status to completed"""
        transcript_success = False
        status_update_success = False

        try:
            # Step 1: Insert transcript data
            transcript_data = {
                "interview_id": interview_id,
                "full_text": full_text,
                "transcript_json": transcript_json,
                "audio_path": audio_path
            }

            await self.client.post("transcripts", transcript_data)
            print(f"✅ Successfully inserted transcript for interview {interview_id}")
            transcript_success = True

        except Exception as e:
            print(f"❌ Error inserting transcript: {e}")
            return False

        try:
            # Step 2: Update interviews table status from 'scheduled' to 'completed'
            status_update = {
                "status": "completed"
            }

            await self.client.patch("interviews", {"interview_id": interview_id}, status_update)
            print(f"✅ Successfully updated interviews table record {interview_id} status to 'completed'")
            status_update_success = True

        except Exception as e:
            print(f"⚠️ Could not update interview status (likely RLS restriction): {e}")
            print(f"💡 Transcript was saved successfully. Status update requires proper permissions.")
            status_update_success = False

        # Return True if transcript was saved (the critical operation)
        if transcript_success:
            if status_update_success:
                print(f"🎉 Complete success: Transcript saved AND status updated")
            else:
                print(f"⚠️ Partial success: Transcript saved but status update failed due to permissions")
            return True
        else:
            return False

load_dotenv(override=True)

TRANSCRIPT_BASE_DIR = Path("storage")
# Hardcoded auth token for testing
TEST_AUTH_TOKEN = "5ebb4526-c63a-4025-8cdb-4cd1a515c519"
_shutdown_services_callback = None
_context_aggregator = None  # Global reference for context access

# We store functions so objects (e.g. SileroVADAnalyzer) don't get
# instantiated. The function will be called when the desired transport gets
# selected.


async def clean_context_and_summarize(params: FunctionCallParams):
    """Tool for LLM to clean context with a provided summary"""
    global _context_aggregator

    logger.info("Context cleaning tool called")

    # Get the summary from the LLM's function call
    summary = params.arguments.get("summary", "")

    if not summary:
        await params.result_callback({
            "status": "error",
            "message": "Summary is required"
        })
        return

    # Get current context from the global context aggregator
    if not _context_aggregator:
        await params.result_callback({
            "status": "error",
            "message": "Context aggregator not available"
        })
        return

    # Access the context from the aggregator
    context = _context_aggregator._user._context  # Access the shared context
    current_messages = context.get_messages()

    logger.info(f"Current context has {len(current_messages)} messages")

    # Preserve initial system prompt
    initial_system_msg = next((msg for msg in current_messages if msg["role"] == "system"), None)

    # Create new cleaned context
    cleaned_messages = []
    if initial_system_msg:
        cleaned_messages.append(initial_system_msg)

    # Add the summary as a system message
    cleaned_messages.append({
        "role": "system",
        "content": f"Interview Progress Summary: {summary}"
    })

    # Reset context to cleaned version
    context.set_messages(cleaned_messages)

    messages_removed = len(current_messages) - len(cleaned_messages)
    logger.info(f"Context cleaned: removed {messages_removed} messages, kept {len(cleaned_messages)} messages")

    await params.result_callback({
        "status": "context_cleaned",
        "summary": summary,
        "messages_removed": messages_removed,
        "remaining_messages": len(cleaned_messages)
    })


async def end_conversation(params: FunctionCallParams):
    # Optional: speak a goodbye
    await params.llm.push_frame(TTSSpeakFrame("Okay, Thank you for joining us today, I'll be ending the session now."))
    # Push an EndTaskFrame upstream to terminate gracefully
    await params.llm.push_frame(EndTaskFrame())

# Enhanced function schemas
clean_context_schema = FunctionSchema(
    name="clean_context_and_summarize",
    description="Clean the conversation context and provide a summary when a question has been sufficiently answered. Use this when you feel the current question/topic has been thoroughly discussed and you want to move to the next question.",
    properties={
        "summary": {
            "type": "string",
            "description": "A concise summary of the key points from the recently completed Q&A exchange, including the question asked and the candidate's main responses. Focus on important insights, skills demonstrated, or red flags identified."
        }
    },
    required=["summary"]
)

end_fn_schema = FunctionSchema(
    name="end_conversation",
    description="End the current session and say goodbye",
    properties={},
    required=[]
)

tools = ToolsSchema(standard_tools=[clean_context_schema, end_fn_schema])


transport_params = {}

# Always include WebRTC transport
transport_params["webrtc"] = lambda: TransportParams(
    audio_in_enabled=True,
    audio_out_enabled=True,
    video_out_enabled=True,
    video_out_is_live=True,
    video_out_width=512,
    video_out_height=512,
    vad_analyzer=SileroVADAnalyzer(params=VADParams(stop_secs=0.2)),
    turn_analyzer=LocalSmartTurnAnalyzerV3(params=SmartTurnParams()),
)

# Add Daily transport only if available
if DAILY_AVAILABLE:
    transport_params["daily"] = lambda: DailyParams(
        audio_in_enabled=True,
        audio_out_enabled=True,
        video_out_enabled=True,
        video_out_is_live=True,
        video_out_width=512,
        video_out_height=512,
        vad_analyzer=SileroVADAnalyzer(params=VADParams(stop_secs=0.2)),
        turn_analyzer=LocalSmartTurnAnalyzerV3(params=SmartTurnParams()),
    )

# For API-launched bots, force WebRTC transport
if os.getenv("TRANSPORT") == "webrtc":
    transport_params = {
        "webrtc": transport_params["webrtc"]
    }


async def run_bot(transport: BaseTransport, runner_args: RunnerArguments):
    global _context_aggregator

    logger.info(f"Starting bot with context management")

    # Extract auth_token from environment variable (for API-launched bots) or room URL
    auth_token = os.getenv("AUTH_TOKEN") or (getattr(transport, 'room_url', '').split('/')[-1] if hasattr(transport, 'room_url') else None) or TEST_AUTH_TOKEN
    
    logger.info(f"Using auth_token: {auth_token}")

    # Retrieve interview context from Supabase using auth_token
    queue_service = QueueService()
    interviewer_record = await queue_service.get_interviewer_context(auth_token)

    if not interviewer_record:
        logger.error("Failed to retrieve interviewer record from queue")
        # Handle error case - perhaps use default context or abort
        return

    # Extract the payload containing the interview context
    interview_payload = interviewer_record.get('payload', {})

    if not interview_payload:
        logger.warning("No payload found in interviewer record")
        # Use default context or abort
        return

    interview_id = interview_payload.get('interview_id')
    candidate_name = interview_payload.get('candidate_name')
    job_title = interview_payload.get('job_title')
    questions = interview_payload.get('questions', [])
    resume_text = interview_payload.get('resume_text')
    job_description = interview_payload.get('job_description')
    interviewer_prompt = interview_payload.get('interviewer_prompt')

    logger.info(f"Retrieved interview context for {candidate_name} applying for {job_title} (ID: {interview_id})")

    stt = DeepgramSTTService(
        api_key=os.getenv("DEEPGRAM_API_KEY"),
        live_options=LiveOptions(model="nova-3",),
    )

    tts = ElevenLabsTTSService(
        api_key=os.getenv("ELEVENLABS_API_KEY", ""),
        voice_id=os.getenv("ELEVENLABS_VOICE_ID", ""),
    )

    simli_ai = SimliVideoService(
        SimliConfig(os.getenv("SIMLI_API_KEY"), os.getenv("SIMLI_FACE_ID")),
    )

    llm = GoogleLLMService(
        api_key=os.getenv("GOOGLE_API_KEY"),
        model="gemini-2.5-flash",
    )

    # Register both tools
    llm.register_function(
        "clean_context_and_summarize",
        clean_context_and_summarize,
        cancel_on_interruption=True,
    )

    llm.register_function(
        "end_conversation",
        end_conversation,
        cancel_on_interruption=True,
    )

    # Enhanced system prompt with context management instructions
    messages = [
        {
            "role": "system",
            "content": interviewer_prompt,
        },
    ]

    context = LLMContext(messages, tools=tools)
    context_aggregator = LLMContextAggregatorPair(context)

    # Store global reference for tool access
    _context_aggregator = context_aggregator

    transcript = TranscriptProcessor()
    session_timestamp = datetime.utcnow()
    session_transcript_dir = TRANSCRIPT_BASE_DIR
    transcript_path = session_transcript_dir / f"interview-{interview_id}.md"
    transcript_initialized = False
    services_shutdown = False

    async def shutdown_services():
        nonlocal services_shutdown
        if services_shutdown:
            return
        services_shutdown = True
        try:
            await tts.stop(EndFrame())
        except Exception:
            logger.exception("Failed to stop ElevenLabs TTS service")
        try:
            await tts.cleanup()
        except Exception:
            logger.exception("Failed to clean up ElevenLabs TTS service")

        # Save transcript to Supabase when interview ends
        transcript_service = TranscriptService()

        try:
            with open(transcript_path, 'r', encoding='utf-8') as f:
                full_text = f.read()

            # Create transcript_json with interview metadata
            transcript_json = {
                "interview_id": interview_id,
                "candidate_name": candidate_name,
                "job_title": job_title,
                "questions_asked": len(questions),
                "transcript_length": len(full_text),
                "session_timestamp": session_timestamp.isoformat()
            }

            success = await transcript_service.write_transcript(
                interview_id=interview_id,
                full_text=full_text,
                transcript_json=transcript_json
            )

            if success:
                logger.info(f"Transcript saved to Supabase for interview {interview_id}")
            else:
                logger.error(f"Failed to save transcript to Supabase for interview {interview_id}")

        except FileNotFoundError:
            logger.error(f"Transcript file not found: {transcript_path}")
        except Exception as e:
            logger.error(f"Error saving transcript: {e}")

    global _shutdown_services_callback
    _shutdown_services_callback = shutdown_services

    pipeline = Pipeline(
        [
            transport.input(),
            stt,
            transcript.user(),
            context_aggregator.user(),
            llm,
            tts,
            simli_ai,
            transport.output(),
            transcript.assistant(),
            context_aggregator.assistant(),
        ]
    )

    task = PipelineTask(
        pipeline,
        params=PipelineParams(
            enable_metrics=True,
            enable_usage_metrics=True,
        ),
        idle_timeout_secs=180,
        idle_timeout_frames=(TTSSpeakFrame, LLMRunFrame,),
        cancel_on_idle_timeout=False
    )

    @transport.event_handler("on_client_connected")
    async def on_client_connected(transport, client):
        logger.info(f"Client connected - starting interview")
        # Initialize pipeline with StartFrame first, then start conversation
        await task.queue_frames([StartFrame(), LLMRunFrame()])

    @transport.event_handler("on_client_disconnected")
    async def on_client_disconnected(transport, client):
        logger.info(f"Client disconnected - ending interview")
        await task.cancel()
        await shutdown_services()

    @task.event_handler("on_idle_timeout")
    async def on_idle_timeout(task):
        logger.info("Conversation has been idle for 60 seconds")
        # Add a farewell message
        await task.queue_frame(TTSSpeakFrame("I haven't heard from you in a while. Goodbye!"))

        # Then end the conversation gracefully
        await task.stop_when_done()

    @transcript.event_handler("on_transcript_update")
    async def handle_transcript_update(processor, frame):
        nonlocal transcript_initialized
        if not frame.messages:
            return
        if not transcript_initialized:
            session_transcript_dir.mkdir(parents=True, exist_ok=True)
            with transcript_path.open("w", encoding="utf-8") as md_file:
                md_file.write(
                    f"# Interview Transcript - {session_timestamp:%Y-%m-%d %H:%M UTC}\n\n"
                    f"**Interview ID:** `{interview_id}`\n\n"
                    "## Interview Context\n"
                    f"- **Candidate:** {candidate_name}\n"
                    f"- **Position:** {job_title}\n"
                    f"- **Status:** In Progress\n\n"
                )
            transcript_initialized = True
        lines = []
        for message in frame.messages:
            role = message.role.capitalize()
            timestamp = message.timestamp or datetime.utcnow().isoformat()
            content = message.content.strip().replace("\n", "  \n")
            lines.append(f"- **{timestamp} – {role}:** {content}")
        with transcript_path.open("a", encoding="utf-8") as md_file:
            md_file.write("\n".join(lines) + "\n")


    runner = PipelineRunner(handle_sigint=runner_args.handle_sigint)
    try:
        await runner.run(task)
    finally:
        await shutdown_services()
        if _shutdown_services_callback is shutdown_services:
            _shutdown_services_callback = None


async def bot(runner_args: RunnerArguments):
    """Main bot entry point compatible with Pipecat Cloud."""
    transport = await create_transport(runner_args, transport_params)
    await run_bot(transport, runner_args)


if __name__ == "__main__":
    from pipecat.runner.run import main

    main()
