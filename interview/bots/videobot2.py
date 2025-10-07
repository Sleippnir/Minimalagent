import os
from datetime import datetime
from config import config
from dotenv import load_dotenv
from pathlib import Path

from pipecat.services.google.stt import GoogleSTTService, Language
from pipecat.services.elevenlabs.tts import ElevenLabsTTSService
from pipecat.services.google.llm import GoogleLLMService
from pipecat.audio.turn.smart_turn.base_smart_turn import SmartTurnParams
from pipecat.audio.turn.smart_turn.local_smart_turn_v3 import LocalSmartTurnAnalyzerV3
from pipecat.audio.vad.silero import SileroVADAnalyzer
from pipecat.audio.vad.vad_analyzer import VADParams
from pipecat.frames.frames import LLMRunFrame
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
from context_service import services
from pipecat.transports.base_transport import BaseTransport, TransportParams
from pipecat.transports.daily.transport import DailyParams
from pipecat.frames.frames import EndFrame, EndTaskFrame, TTSSpeakFrame, TextFrame
from pipecat.processors.frame_processor import FrameDirection
from pipecat.services.llm_service import FunctionCallParams
from pipecat.adapters.schemas.tools_schema import ToolsSchema
from pipecat.adapters.schemas.function_schema import FunctionSchema
from pipecat.processors.transcript_processor import TranscriptProcessor
from simli import SimliConfig

from loguru import logger

load_dotenv(override=True)

TRANSCRIPT_BASE_DIR = Path(config.TRANSCRIPT_BASE_DIR)

_context_aggregator = None


async def clean_context_and_summarize(params: FunctionCallParams):
    """Tool for LLM to clean context with a provided summary"""
    global _context_aggregator

    logger.info("Context cleaning tool called")

    # Get the summary from the LLM's function call
    summary = params.arguments.get("summary", "")

    if not summary:
        await params.result_callback(
            {"status": "error", "message": "Summary is required"}
        )
        return

    # Get current context from the global context aggregator
    if not _context_aggregator:
        await params.result_callback(
            {"status": "error", "message": "Context aggregator not available"}
        )
        return

    # Access the context from the aggregator
    context = _context_aggregator._user._context  # Access the shared context
    current_messages = context.get_messages()

    logger.info(f"Current context has {len(current_messages)} messages")

    # Preserve initial system prompt
    initial_system_msg = next(
        (msg for msg in current_messages if msg["role"] == "system"), None
    )

    # Create new cleaned context
    cleaned_messages = []
    if initial_system_msg:
        cleaned_messages.append(initial_system_msg)

    # Add the summary as a system message
    cleaned_messages.append(
        {"role": "system", "content": f"Interview Progress Summary: {summary}"}
    )

    # Reset context to cleaned version
    context.set_messages(cleaned_messages)

    messages_removed = len(current_messages) - len(cleaned_messages)
    logger.info(
        f"Context cleaned: removed {messages_removed} messages, kept {len(cleaned_messages)} messages"
    )

    await params.result_callback(
        {
            "status": "context_cleaned",
            "summary": summary,
            "messages_removed": messages_removed,
            "remaining_messages": len(cleaned_messages),
        }
    )


async def end_conversation(params: FunctionCallParams):
    # Optional: speak a goodbye
    await params.llm.push_frame(
        TTSSpeakFrame(
            "Okay, Thank you for joining us today, I'll be ending the session now."
        )
    )
    # Push an EndTaskFrame upstream to terminate gracefully
    await params.llm.push_frame(EndTaskFrame())


# Enhanced function schemas
clean_context_schema = FunctionSchema(
    name="clean_context_and_summarize",
    description="Clean the conversation context and provide a summary when a question has been sufficiently answered. Use this when you feel the current question/topic has been thoroughly discussed and you want to move to the next question.",
    properties={
        "summary": {
            "type": "string",
            "description": "A concise summary of the key points from the recently completed Q&A exchange, including the question asked and the candidate's main responses. Focus on important insights, skills demonstrated, or red flags identified.",
        }
    },
    required=["summary"],
)

end_fn_schema = FunctionSchema(
    name="end_conversation",
    description="End the current session and say goodbye",
    properties={},
    required=[],
)

tools = ToolsSchema(standard_tools=[clean_context_schema, end_fn_schema])


transport_params = {
    "daily": lambda: DailyParams(
        audio_in_enabled=True,
        audio_out_enabled=True,
        video_out_enabled=True,
        video_out_is_live=True,
        video_out_width=512,
        video_out_height=512,
        vad_analyzer=SileroVADAnalyzer(params=VADParams(stop_secs=0.2)),
        turn_analyzer=LocalSmartTurnAnalyzerV3(params=SmartTurnParams()),
    ),
    "webrtc": lambda: TransportParams(
        audio_in_enabled=True,
        audio_out_enabled=True,
        video_out_enabled=True,
        video_out_is_live=True,
        video_out_width=512,
        video_out_height=512,
        vad_analyzer=SileroVADAnalyzer(params=VADParams(stop_secs=0.2)),
        turn_analyzer=LocalSmartTurnAnalyzerV3(params=SmartTurnParams()),
    ),
}


async def run_bot(transport: BaseTransport, runner_args: RunnerArguments):
    global _context_aggregator

    logger.info(f"Starting bot with context management")

    # Extract auth_token from room URL (room name is the auth_token)
    room_url = getattr(transport, "room_url", "")
    auth_token = (
        room_url.split("/")[-1] if room_url else config.AUTH_TOKEN
    )  # Fallback to config for testing

    logger.info(f"Using auth_token: {auth_token}")

    # Retrieve interview context from queue
    queue_service = services.QueueService()
    interview_context_payload = await queue_service.get_interview_context_from_queue(
        auth_token
    )

    interview_context = {}
    if interview_context_payload and "payload" in interview_context_payload:
        interview_context = interview_context_payload["payload"]
    elif interview_context_payload:
        interview_context = interview_context_payload  # For backward compatibility

    if interview_context:
        logger.info(f"Retrieved interview context for token {auth_token}")
    else:
        logger.warning(
            f"No interview context found for token {auth_token}, using defaults."
        )
        interview_context = {}

    stt = DeepgramSTTService(
        api_key=config.DEEPGRAM_API_KEY,
        live_options=LiveOptions(
            model="nova-3",
        ),
    )

    tts = ElevenLabsTTSService(
        api_key=config.ELEVENLABS_API_KEY,
        voice_id=config.ELEVENLABS_VOICE_ID,
    )

    simli_ai = SimliVideoService(
        SimliConfig(config.SIMLI_API_KEY, config.SIMLI_FACE_ID),
    )

    llm = GoogleLLMService(
        api_key=config.GOOGLE_API_KEY,
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
    system_prompt = interview_context.get(
        "interviewer_prompt",
        "You are an AI interviewer conducting a technical interview. Ask relevant questions and evaluate responses.",
    )

    messages = [
        {
            "role": "system",
            "content": system_prompt,
        },
    ]

    context = LLMContext(messages, tools=tools)
    context_aggregator = LLMContextAggregatorPair(context)

    # Store global reference for tool access
    _context_aggregator = context_aggregator

    transcript = TranscriptProcessor()
    session_timestamp = datetime.utcnow()
    interview_id = interview_context.get(
        "interview_id", f"session-{session_timestamp:%Y%m%dT%H%M%SZ}"
    )
    session_transcript_dir = TRANSCRIPT_BASE_DIR
    transcript_path = session_transcript_dir / f"{interview_id}.md"
    transcript_initialized = False
    services_shutdown = False

    async def shutdown_services():
        nonlocal services_shutdown
        if services_shutdown:
            return
        services_shutdown = True
        logger.info("Shutting down services...")
        try:
            await tts.stop(EndFrame())
            await tts.cleanup()
        except Exception:
            logger.exception("Failed to stop or clean up ElevenLabs TTS service")

        # Save transcript to Supabase if interview_id is available
        if interview_context and interview_context.get("interview_id"):
            try:
                transcript_service = services.TranscriptService()
                if transcript_path.exists():
                    with transcript_path.open("r", encoding="utf-8") as f:
                        full_text = f.read()

                    # Create transcript_json with interview metadata
                    transcript_json = {
                        "interview_id": interview_context.get("interview_id"),
                        "candidate_name": interview_context.get("candidate_name"),
                        "job_title": interview_context.get("job_title"),
                        "session_timestamp": session_timestamp.isoformat(),
                    }

                    await transcript_service.write_transcript(
                        interview_id=interview_context["interview_id"],
                        full_text=full_text,
                        transcript_json=transcript_json,
                    )
                    logger.info(
                        f"Successfully saved transcript for interview {interview_context['interview_id']}"
                    )
                else:
                    logger.warning(
                        f"Transcript file {transcript_path} not found, cannot save to Supabase."
                    )
            except Exception as e:
                logger.error(f"Failed to save transcript to Supabase: {e}")
        else:
            logger.warning(
                "No interview_id in context, skipping transcript save to Supabase."
            )

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
        idle_timeout_frames=(
            TTSSpeakFrame,
            LLMRunFrame,
        ),
        cancel_on_idle_timeout=False,
    )

    @transport.event_handler("on_client_connected")
    async def on_client_connected(transport, client):
        logger.info(f"Client connected - starting interview")
        # Start conversation - empty prompt to let LLM follow system instructions
        await task.queue_frames([LLMRunFrame()])

    @transport.event_handler("on_client_disconnected")
    async def on_client_disconnected(transport, client):
        logger.info(f"Client disconnected - ending interview")
        await task.cancel()
        await shutdown_services()

    @task.event_handler("on_idle_timeout")
    async def on_idle_timeout(task):
        logger.info("Conversation has been idle for 180 seconds")
        # Add a farewell message
        await task.queue_frame(
            TTSSpeakFrame("I haven't heard from you in a while. Goodbye!")
        )

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
                    f"# Interview transcript for {interview_id} ({session_timestamp:%Y-%m-%d %H:%M UTC})\n\n"
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
        logger.info("Pipeline runner finished.")
        await shutdown_services()


async def bot(runner_args: RunnerArguments):
    """Main bot entry point compatible with Pipecat Cloud."""
    transport = await create_transport(runner_args, transport_params)
    await run_bot(transport, runner_args)


if __name__ == "__main__":
    from pipecat.runner.run import main

    main()
