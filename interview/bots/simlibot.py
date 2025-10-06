import os
from typing import Optional

from dotenv import load_dotenv
from loguru import logger
from simli import SimliConfig
from datetime import datetime
from pathlib import Path
import asyncio

from pipecat.services.google.stt import GoogleSTTService, Language
from pipecat.services.elevenlabs.tts import ElevenLabsTTSService
from pipecat.services.google.llm import GoogleLLMService
from pipecat.audio.turn.smart_turn.base_smart_turn import SmartTurnParams
from pipecat.audio.turn.smart_turn.local_smart_turn_v3 import LocalSmartTurnAnalyzerV3
from pipecat.audio.vad.silero import SileroVADAnalyzer
from pipecat.audio.vad.vad_analyzer import VADParams
from pipecat.frames.frames import LLMRunFrame, StartFrame, TextFrame
from pipecat.pipeline.pipeline import Pipeline
from pipecat.pipeline.runner import PipelineRunner
from pipecat.pipeline.task import PipelineParams, PipelineTask
from pipecat.processors.aggregators.llm_context import LLMContext
from pipecat.processors.aggregators.llm_response_universal import (
    LLMContextAggregatorPair,
)
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
from pipecat.services.whisper.stt import WhisperSTTService


# Import Supabase client from context service
from ..context_service.client import SupabaseClient, get_supabase_client
from ..context_service.services import QueueService, TranscriptService
from ..context_service.models import InterviewContext

# Import interview tools
from ..tools import (
    clean_context_and_summarize,
    end_conversation,
    get_interview_tools_schema,
    set_context_aggregator,
)


# Singleton instance
_client = None


load_dotenv(override=True)

TRANSCRIPT_BASE_DIR = Path("storage")
# Hardcoded auth token for testing
TEST_AUTH_TOKEN = "cac3c4ec-0542-4c3c-b6c1-3e3636fbb89a"
_shutdown_services_callback = None

# We store functions so objects (e.g. SileroVADAnalyzer) don't get
# instantiated. The function will be called when the desired transport gets
# selected.


# Get interview tools schema
tools = get_interview_tools_schema()


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
    data_channels_enabled=True,
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
    transport_params = {"webrtc": transport_params["webrtc"]}


async def run_bot(
    transport: BaseTransport,
    runner_args: RunnerArguments,
    auth_token: Optional[str] = None,
):
    logger.info(f"Starting bot with context management")

    # Use provided auth_token or extract from environment variable (for API-launched bots) or room URL
    if auth_token is None:
        auth_token = (
            os.getenv("AUTH_TOKEN")
            or (
                getattr(transport, "room_url", "").split("/")[-1]
                if hasattr(transport, "room_url")
                else None
            )
            or TEST_AUTH_TOKEN
        )

    logger.info(f"Using auth_token: {auth_token}")

    # Retrieve interview context from Supabase using auth_token
    queue_service = QueueService()
    interviewer_record = await queue_service.get_interview_context_from_queue(
        auth_token
    )

    if not interviewer_record:
        logger.error("Failed to retrieve interviewer record from queue")
        # Handle error case - perhaps use default context or abort
        return

    # Create InterviewContext from the record
    interview_context = InterviewContext.from_supabase_record(interviewer_record)

    logger.info(
        f"Retrieved interview context for {interview_context.candidate_name} applying for {interview_context.job_title} (ID: {interview_context.interview_id})"
    )

    stt = DeepgramSTTService(
        api_key=os.getenv("DEEPGRAM_API_KEY"),
        live_options=LiveOptions(
            model="nova-3",
        ),
    )

    tts = ElevenLabsTTSService(
        api_key=os.getenv("ELEVENLABS_API_KEY", ""),
        voice_id=os.getenv("ELEVENLABS_VOICE_ID", ""),
    )

    simli_ai = SimliVideoService(
        SimliConfig(os.getenv("SIMLI_API_KEY"), 
                    os.getenv("SIMLI_FACE_ID")),
    )
    # simli_ai = None  # Placeholder for now

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

    # Get the formatted context using InterviewContext
    full_system_prompt = interview_context.format_full_context()

    # Enhanced system prompt with context management instructions
    messages = [
        {
            "role": "system",
            "content": full_system_prompt,
        },
    ]

    context = LLMContext(messages, tools=tools)
    context_aggregator = LLMContextAggregatorPair(context)

    # Store global reference for tool access
    set_context_aggregator(context_aggregator)

    transcript = TranscriptProcessor()
    session_timestamp = datetime.now()
    session_transcript_dir = TRANSCRIPT_BASE_DIR
    transcript_path = (
        session_transcript_dir / f"interview-{interview_context.interview_id}.md"
    )
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
            with open(transcript_path, "r", encoding="utf-8") as f:
                full_text = f.read()

            # Create transcript_json with interview metadata
            transcript_json = {
                "interview_id": interview_context.interview_id,
                "candidate_name": interview_context.candidate_name,
                "job_title": interview_context.job_title,
                "questions_asked": len(interview_context.questions),
                "transcript_length": len(full_text),
                "session_timestamp": session_timestamp.isoformat(),
            }

            success = await transcript_service.write_transcript(
                interview_id=interview_context.interview_id,
                full_text=full_text,
                transcript_json=transcript_json,
            )

            if success:
                logger.info(
                    f"Transcript saved to Supabase for interview {interview_context.interview_id}"
                )
            else:
                logger.error(
                    f"Failed to save transcript to Supabase for interview {interview_context.interview_id}"
                )

        except FileNotFoundError:
            logger.error(f"Transcript file not found: {transcript_path}")
        except Exception as e:
            logger.error(f"Error saving transcript: {e}")

    global _shutdown_services_callback
    _shutdown_services_callback = shutdown_services

    # Build pipeline conditionally
    pipeline_components = [
        transport.input(),
        stt,
        transcript.user(),
        context_aggregator.user(),
        llm,
        tts,
    ]

    # Add video service if available
    if simli_ai:
        pipeline_components.append(simli_ai)

    pipeline_components.extend(
        [
            transport.output(),
            transcript.assistant(),
            context_aggregator.assistant(),
        ]
    )

    pipeline = Pipeline(pipeline_components)

    task = PipelineTask(
        pipeline,
        params=PipelineParams(
            enable_metrics=True,
            enable_usage_metrics=True,
        ),
    )

    @transport.event_handler("on_client_connected")
    async def on_client_connected(transport, client):
        logger.info("Client connected, starting interview.")
        # Send StartFrame to initialize the pipeline
        await task.queue_frame(StartFrame())
        # Start conversation with LLM. The LLM will use the system prompt to begin.
        await task.queue_frame(LLMRunFrame())

    @transport.event_handler("on_client_disconnected")
    async def on_client_disconnected(transport, client):
        logger.info(f"Client disconnected - ending interview")
        await task.cancel()
        await shutdown_services()

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
                    f"**Interview ID:** `{interview_context.interview_id}`\n\n"
                    "## Interview Context\n"
                    f"- **Candidate:** {interview_context.candidate_name}\n"
                    f"- **Position:** {interview_context.job_title}\n"
                    f"- **Status:** In Progress\n\n"
                )
            transcript_initialized = True
        lines = []
        for message in frame.messages:
            role = message.role.capitalize()
            timestamp = message.timestamp or datetime.now().isoformat()
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


async def bot(runner_args: RunnerArguments, auth_token: Optional[str] = None):
    """Main bot entry point compatible with Pipecat Cloud."""
    transport = await create_transport(runner_args, transport_params)
    await run_bot(transport, runner_args, auth_token)


# CLI usage
async def main():
    """CLI entry point for testing the simlibot"""
    import sys

    if len(sys.argv) < 2:
        print("Usage: python -m interview.bots.simlibot <auth_token>")
        sys.exit(1)

    auth_token = sys.argv[1]

    try:
        # For CLI testing, set transport to webrtc
        os.environ = "webrtc"

        # Create proper RunnerArguments for CLI testing
        runner_args = RunnerArguments()

        # Create transport directly for CLI testing
        transport = await create_transport(runner_args, transport_params)

        # Run the bot with the transport
        await run_bot(transport, runner_args, auth_token)

    except Exception as e:
        print(f"Error: {e}")
        sys.exit(1)


if __name__ == "__main__":
    import sys

    # Check if running with auth_token argument (CLI mode)
    if len(sys.argv) >= 2 and not sys.argv[1].startswith("--"):
        asyncio.run(main())
    else:
        # Pipecat Cloud mode
        from pipecat.runner.run import main

        main()
