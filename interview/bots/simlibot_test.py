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
from pipecat.services.whisper.stt import WhisperSTTService


# Import interview context and tools
from ..context_service import InterviewContext
from ..tools import get_interview_tools_schema

load_dotenv(override=True)

TRANSCRIPT_BASE_DIR = Path("storage")
TEST_AUTH_TOKEN = "test-token-123"

# We store functions so objects (e.g. SileroVADAnalyzer) don't get
# instantiated. The function will be called when the desired transport gets
# selected.

transport_params = {}

# WebRTC transport configuration
transport_params["webrtc"] = lambda: TransportParams(
    audio_in_enabled=True,
    audio_out_enabled=True,
    video_out_enabled=True,
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
    transport_params = {
        "webrtc": transport_params["webrtc"]
    }


async def run_bot(transport: BaseTransport, runner_args: RunnerArguments, auth_token: Optional[str] = None):
    logger.info(f"Starting test bot with mock context management")

    # Use test auth token if none provided
    if auth_token is None:
        auth_token = TEST_AUTH_TOKEN

    logger.info(f"Using auth_token: {auth_token}")

    # Create mock interview context instead of loading from Supabase
    interview_context = InterviewContext(
        interview_id="test-interview-123",
        candidate_info={
            "first_name": "Test",
            "last_name": "Candidate",
            "email": "test@example.com"
        },
        job_info={
            "title": "Software Engineer",
            "department": "Engineering",
            "level": "Senior"
        },
        questions=[
            {"text": "Tell me about yourself and your background", "type": "behavioral"},
            {"text": "What are your greatest strengths and how do they apply to this role?", "type": "behavioral"},
            {"text": "Describe a challenging technical problem you solved", "type": "technical"},
            {"text": "Why are you interested in working for our company?", "type": "motivational"},
            {"text": "What are your salary expectations?", "type": "practical"},
            {"text": "Do you have any questions for us?", "type": "closing"}
        ],
        evaluation_materials={
            "resume_text": """Experienced Software Engineer with 5+ years of experience in full-stack development.
            Proficient in Python, JavaScript, React, Node.js, and cloud technologies (AWS, GCP).
            Led development of scalable web applications serving 100k+ users.
            Strong background in system design, API development, and team leadership.""",
            "job_description": """We are seeking a Senior Software Engineer to join our growing engineering team.
            You will be responsible for designing, developing, and maintaining scalable web applications.
            Key responsibilities include:
            - Full-stack development using modern technologies
            - API design and implementation
            - Code reviews and mentoring junior developers
            - Participating in system architecture decisions
            - Collaborating with cross-functional teams

            Required skills: Python, JavaScript, React, AWS/GCP, REST APIs, Git
            Nice to have: Docker, Kubernetes, CI/CD, TypeScript"""
        },
        interviewer_prompt="""You are conducting a technical interview for a Senior Software Engineer position.
        Be professional, thorough, and engaging. Ask follow-up questions to dive deeper into the candidate's responses.
        Evaluate their technical skills, problem-solving abilities, communication skills, and cultural fit.
        Use the provided tools to manage conversation context when appropriate.
        Start with a brief introduction and then begin with the first question."""
    )

    logger.info(f"Created mock interview context for {interview_context.candidate_name} applying for {interview_context.job_title}")

    # Use Whisper STT for testing
    stt = WhisperSTTService()

    tts = ElevenLabsTTSService(
        api_key=os.getenv("ELEVENLABS_API_KEY", ""),
        voice_id=os.getenv("ELEVENLABS_VOICE_ID", ""),
    )

    # Temporarily disable Simli video service due to API issues
    simli_ai = None

    llm = GoogleLLMService(
        api_key=os.getenv("GOOGLE_API_KEY"),
        model="gemini-1.5-flash"
    )

    # Set up tools
    tools = get_interview_tools_schema()

    llm = GoogleLLMService(
        api_key=os.getenv("GOOGLE_API_KEY"),
        model="gemini-1.5-flash",
        tools=tools
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

    context = LLMContext(messages=messages)
    context_aggregator = LLMContextAggregatorPair(context)

    # Store global reference for tool access
    from ..tools import set_context_aggregator
    set_context_aggregator(context_aggregator)

    transcript = TranscriptProcessor()
    session_timestamp = datetime.utcnow()
    session_transcript_dir = TRANSCRIPT_BASE_DIR
    transcript_path = session_transcript_dir / f"interview-{interview_context.interview_id}.md"
    transcript_initialized = False
    services_shutdown = False

    async def save_transcript():
        nonlocal transcript_initialized, services_shutdown
        if services_shutdown:
            return

        try:
            # Read the transcript content
            if transcript_path.exists():
                full_text = transcript_path.read_text(encoding="utf-8")

                # Create transcript_json with interview metadata
                transcript_json = {
                    "interview_id": interview_context.interview_id,
                    "candidate_name": interview_context.candidate_name,
                    "job_title": interview_context.job_title,
                    "questions_asked": len(interview_context.questions),
                    "transcript_length": len(full_text),
                    "session_timestamp": session_timestamp.isoformat()
                }

                logger.info(f"Transcript saved to file for interview {interview_context.interview_id}")
            else:
                logger.error(f"Transcript file not found: {transcript_path}")

        except FileNotFoundError:
            logger.error(f"Transcript file not found: {transcript_path}")
        except Exception as e:
            logger.error(f"Error saving transcript: {e}")

    async def shutdown_services():
        nonlocal services_shutdown
        if services_shutdown:
            return
        services_shutdown = True

        await save_transcript()

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

    pipeline_components.extend([
        transport.output(),
        transcript.assistant(),
        context_aggregator.assistant(),
    ])

    pipeline = Pipeline(pipeline_components)

    task = PipelineTask(
        pipeline,
        params=PipelineParams(
            allow_interruptions=True,
            enable_metrics=True,
            enable_usage_metrics=True,
        )
    )

    @transport.event_handler("on_client_connected")
    async def on_client_connected(transport, client):
        logger.info(f"Client connected - starting test interview")
        # Initialize pipeline with StartFrame first, then start conversation
        await task.queue_frames([StartFrame(), LLMRunFrame()])

    @transport.event_handler("on_client_disconnected")
    async def on_client_disconnected(transport, client):
        logger.info("Client disconnected")
        await task.cancel()
        await shutdown_services()

    # Handle input_text messages to start interview
    @transport.event_handler("on_client_message")
    async def on_client_message(transport, message):
        logger.info(f"Received message from client: {message}")
        if isinstance(message, dict) and message.get("type") == "input_text" and message.get("text") == "START_INTERVIEW":
            logger.info("Received START_INTERVIEW signal - beginning conversation")
            # Add START_INTERVIEW as a user message to trigger the LLM
            await context_aggregator.user().push_frame(TextFrame("START_INTERVIEW"))
            # Start conversation with LLM
            await task.queue_frame(LLMRunFrame())

    @task.event_handler("on_idle_timeout")
    async def on_idle_timeout(task):
        logger.info("Conversation has been idle for 60 seconds")
        await transport.send_text("The interview session has timed out due to inactivity.")
        await task.cancel()
        await shutdown_services()

    @task.event_handler("on_start")
    async def on_start(task):
        nonlocal transcript_initialized
        if not transcript_initialized:
            # Create transcript directory if it doesn't exist
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

    runner = PipelineRunner(handle_sigint=runner_args.handle_sigint)

    # Send StartFrame right before pipeline starts running
    await task.queue_frame(StartFrame(
        allow_interruptions=True,
        enable_metrics=True,
        enable_usage_metrics=True
    ))

    try:
        await runner.run(task)
    finally:
        await shutdown_services()


async def bot(runner_args: RunnerArguments, auth_token: Optional[str] = None):
    """Main bot entry point compatible with Pipecat Cloud."""
    transport = await create_transport(runner_args, transport_params)
    await run_bot(transport, runner_args, auth_token)


# CLI usage
async def main():
    """CLI entry point for testing the simlibot with mock data"""
    import sys

    try:
        # For CLI testing, set transport to webrtc
        os.environ["TRANSPORT"] = "webrtc"

        # Create proper RunnerArguments for CLI testing
        runner_args = RunnerArguments()

        # Create transport directly for CLI testing
        transport = await create_transport(runner_args, transport_params)

        # Run the bot with the transport
        await run_bot(transport, runner_args)

    except Exception as e:
        print(f"Error: {e}")
        import traceback
        traceback.print_exc()
        sys.exit(1)


if __name__ == "__main__":
    import sys

    # Check if running with auth_token argument (CLI mode)
    if len(sys.argv) >= 2 and not sys.argv[1].startswith('--'):
        asyncio.run(main())
    else:
        # Pipecat Cloud mode
        from pipecat.runner.run import main
        main()