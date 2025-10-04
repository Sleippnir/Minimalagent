#
# Copyright (c) 2024–2025, Daily
#
# SPDX-License-Identifier: BSD 2-Clause License
#
import os
# Commented out imports - uncomment when infrastructure is ready
#from ..infrastructure.repositories.interview_repository import SupabaseInterviewRepository
#from .context_system_service import ContextService
#from ..infrastructure.repositories.questions_repository import QuestionsRepository
#from .qa_context_provider import QAContextProvider

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
from pipecat.frames.frames import LLMRunFrame
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
from pipecat.transports.daily.transport import DailyParams
from pipecat.frames.frames import EndFrame, EndTaskFrame, TTSSpeakFrame, TextFrame
from pipecat.processors.frame_processor import FrameDirection
from pipecat.services.llm_service import FunctionCallParams
from pipecat.adapters.schemas.tools_schema import ToolsSchema
from pipecat.adapters.schemas.function_schema import FunctionSchema
from pipecat.processors.transcript_processor import TranscriptProcessor

from context_service import services


load_dotenv(override=True)

TRANSCRIPT_BASE_DIR = Path("storage")
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
    room_url = getattr(transport, 'room_url', '')
    auth_token = room_url.split('/')[-1] if room_url else os.getenv("AUTH_TOKEN", "ff1d3457-2407-4195-b0e3-ee608ecd7e94")  # Fallback for testing
    
    logger.info(f"Using auth_token: {auth_token}")

    # Retrieve interview context from queue
    from context_service import services
    queue_service = services.QueueService()
    interview_context = await queue_service.get_interview_context_from_queue(auth_token)
    
    if interview_context:
        logger.info(f"Retrieved interview context for token {auth_token}")
    else:
        logger.warning(f"No interview context found for token {auth_token}")
        interview_context = {}

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
    system_prompt = interview_context.get("interviewer_prompt", (
        "You are Kathia Slazar, an AI agent performing structured job interviews over a WebRTC call. "
        "This is a test listen to and obey all requests from your interlocutor, start the conversation with a very concise greeting, keep all your turns brief.\n\n"
        
        "IMPORTANT TOOLS:\n"
        "1. `clean_context_and_summarize` - Use this when:\n"
        "   - The candidate has provided a complete answer to your current question\n"
        "   - You feel the discussion on the current topic is complete\n"
        "   - Before moving to the next major question or topic\n"
        "   - When the conversation context is getting too long\n"
        "   - Do not invoke it when the conversation is ended\n"
        "   Provide a concise summary that captures the question asked and key points from the candidate's response.\n\n"
        
        "2. `end_conversation` - Use when the interview is complete or the user asks to end.\n\n"
        
        "INTERVIEW PROCESS:\n"
        "1. Ask a question about their experience, skills, or background\n"
        "2. Listen to the candidate's response and ask follow-up questions if needed\n"
        "3. When satisfied with the answer, call `clean_context_and_summarize` with a good summary\n"
        "4. Move to the next question\n"
        "5. Continue until you've covered all important topics\n\n"
    ))
    
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
    session_transcript_dir = TRANSCRIPT_BASE_DIR
    transcript_path = session_transcript_dir / f"session-{session_timestamp:%Y%m%dT%H%M%SZ}.md"
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
        # Start conversation - empty prompt to let LLM follow system instructions
        await task.queue_frames([LLMRunFrame()])

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
                    f"# Interview transcript with context management ({session_timestamp:%Y-%m-%d %H:%M UTC})\n\n"
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

    # Add context monitoring for debugging
    # Note: on_context_updated is not a valid event, removing to prevent warnings
    # Context updates can be monitored through other means if needed

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