import os
from typing import Optional

from dotenv import load_dotenv
from loguru import logger
from simli import SimliConfig
from datetime import datetime
from pathlib import Path
import asyncio

# Core Pipecat imports
from pipecat.pipeline.pipeline import Pipeline
from pipecat.pipeline.runner import PipelineRunner
from pipecat.pipeline.task import PipelineParams, PipelineTask
from pipecat.runner.types import RunnerArguments
from pipecat.runner.utils import create_transport
from pipecat.transports.base_transport import BaseTransport, TransportParams
from pipecat.frames.frames import StartFrame
from pipecat.processors.transcript_processor import TranscriptProcessor

# VAD and Turn Taking
from pipecat.audio.turn.smart_turn.base_smart_turn import SmartTurnParams
from pipecat.audio.turn.smart_turn.local_smart_turn_v3 import LocalSmartTurnAnalyzerV3
from pipecat.audio.vad.silero import SileroVADAnalyzer
from pipecat.audio.vad.vad_analyzer import VADParams

# Pipecat Services
from pipecat.services.google.llm import GoogleLLMService
from pipecat.services.elevenlabs.tts import ElevenLabsTTSService
from pipecat.services.deepgram.stt import DeepgramSTTService, LiveOptions
from pipecat.services.simli.video import SimliVideoService

# Try to import Daily transport
try:
    from pipecat.transports.daily.transport import DailyParams

    DAILY_AVAILABLE = True
except ImportError:
    DAILY_AVAILABLE = False
    DailyParams = None

# NEW: Pipecat Flows imports for structured conversations
from pipecat_flows import FlowManager, FlowArgs, NodeConfig, FlowsFunctionSchema

# Import application-specific context and services
from ..context_service.services import QueueService, TranscriptService
from ..context_service.models import InterviewContext

# Singleton instance
_client = None

load_dotenv(override=True)

TRANSCRIPT_BASE_DIR = Path("storage")
TEST_AUTH_TOKEN = "3ed18a89-7315-43af-a016-18692ba77571"
_shutdown_services_callback = None

# Transport configurations (unchanged)
transport_params = {}
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
if os.getenv("TRANSPORT") == "webrtc":
    transport_params = {"webrtc": transport_params["webrtc"]}

# ----------------------------------------------------------------------------
# 1. DEFINE FLOW NODES AND FUNCTION HANDLERS
# We define the logic for each step of the interview conversation.
# ----------------------------------------------------------------------------

# -- Function Handlers: Logic that runs when tools are called --


async def handle_summarize_and_next_question(
    args: FlowArgs, flow_manager: FlowManager
) -> tuple[str, NodeConfig]:
    """
    This handler is called by the 'clean_context_and_summarize' tool.
    It stores the summary and dynamically creates and transitions to the next node
    in the interview, which is either the next question or the closing section.
    """
    summary = args["summary"]
    logger.info(f"Storing summary: {summary}")
    if "summaries" not in flow_manager.state:
        flow_manager.state["summaries"] = []
    flow_manager.state["summaries"].append(summary)

    current_question_pos = flow_manager.state.get("current_question_pos", 0)
    interview_context: InterviewContext = flow_manager.state["interview_context"]
    next_question_pos = current_question_pos + 1

    if next_question_pos < len(interview_context.questions):
        # If there are more questions, transition to the next question node
        logger.info(f"Transitioning to question {next_question_pos + 1}")
        next_node = create_question_node(
            interview_context=interview_context, question_position=next_question_pos
        )
    else:
        # If all questions are done, transition to the candidate questions node
        logger.info("All questions answered, transitioning to candidate questions.")
        next_node = create_candidate_questions_node()

    return (
        f"Summary of question {current_question_pos + 1} has been processed.",
        next_node,
    )


async def handle_end_conversation(
    args: FlowArgs, flow_manager: FlowManager
) -> tuple[str, NodeConfig]:
    """
    This handler is called by the 'end_conversation' tool.
    It transitions the flow to the final "end_node".
    """
    logger.info("LLM has decided to end the conversation.")
    return "The user is ready to end the call.", create_end_node()


# -- Schemas: Define the tools available to the LLM in different nodes --

# summarize_schema = FlowsFunctionSchema(
#     name="clean_context_and_summarize",
#     description="Call after a question is sufficiently answered to clean context and store a summary.",
#     handler=handle_summarize_and_next_question,
#     properties={
#         "summary": {
#             "type": "string",
#             "description": "A concise summary of the candidate's answer, capturing key evidence, strengths, and any flags.",
#         }
#     },
#     required=["summary"],
# )

# end_conversation_schema = FlowsFunctionSchema(
#     name="end_conversation",
#     description="Call to end the session when the candidate has no more questions or requests to finish.",
#     handler=handle_end_conversation,
# )


# -- Node Creators: Functions that build the configuration for each conversational state --


def create_end_node() -> NodeConfig:
    """This node says a final goodbye and then gracefully terminates the pipeline."""
    return NodeConfig(
        name="end",
        task_messages=[
            {
                "role": "system",
                "content": "Thank you for participating in this interview. The session is now complete.",
            }
        ],
        post_actions=[
            end_conversation_action()
        ],  # Built-in action to stop the pipeline
    )


def create_candidate_questions_node() -> NodeConfig:
    """This node is for after all scripted questions are asked."""
    return NodeConfig(
        name="candidate_questions",
        task_messages=[
            {
                "role": "system",
                "content": "You have completed all the prepared questions. Do you have any questions for us about the role or the company?",
            }
        ],
        functions=[end_conversation_schema],
    )


def create_question_node(
    interview_context: InterviewContext, question_position: int
) -> NodeConfig:
    """Creates a node for a specific interview question."""
    question = interview_context.questions[question_position]
    return NodeConfig(
        name=f"question_{question_position + 1}",
        task_messages=[
            {
                "role": "system",
                "content": f"Ask the following question: {question['question']}. Listen to the candidate's full response. Once they have answered sufficiently, you MUST call the `clean_context_and_summarize` function with a concise summary of their answer.",
            }
        ],
        functions=[summarize_schema],
        # This strategy clears the context for each new question, matching the original prompt's requirement.
        context_strategy="RESET",
    )


def create_greeting_node(interview_context: InterviewContext) -> NodeConfig:
    """Creates the initial greeting node that starts the interview flow."""

    # This handler's only job is to transition to the first question.
    async def start_first_question(
        args: FlowArgs, flow_manager: FlowManager
    ) -> tuple[str, NodeConfig]:
        logger.info("Greeting complete, transitioning to first question.")
        first_question_node = create_question_node(interview_context, 0)
        return "Greeting complete, beginning questions.", first_question_node

    # A tool for the LLM to call to explicitly start the question phase.
    transition_to_first_question_schema = FlowsFunctionSchema(
        name="start_interview_questions",
        description="Call this function after delivering the greeting and the candidate is ready to begin.",
        handler=start_first_question,
    )

    num_questions = len(interview_context.questions)
    greeting_prompt = f"""
    You are Kathia Salazar, a voice interviewer for anyone AI.
    Your first task is to greet the candidate, {interview_context.candidate_name}.
    Set the expectations: there will be {num_questions} questions about the {interview_context.job_title} role.
    After the candidate confirms they are ready, you MUST call the 'start_interview_questions' function to proceed.
    """
    return NodeConfig(
        name="greeting",
        task_messages=[{"role": "system", "content": greeting_prompt}],
        functions=[transition_to_first_question_schema],
    )


# ----------------------------------------------------------------------------
# 2. REFACTORED BOT LOGIC
# The main `run_bot` function is updated to use the FlowManager.
# ----------------------------------------------------------------------------


async def run_bot(
    transport: BaseTransport,
    runner_args: RunnerArguments,
    auth_token: Optional[str] = None,
):
    logger.info("Starting bot with Pipecat Flows context management")

    # --- Context and Service Initialization (largely unchanged) ---
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

    queue_service = QueueService()
    interviewer_record = await queue_service.get_interview_context_from_queue(
        auth_token
    )

    if not interviewer_record:
        logger.error("Failed to retrieve interviewer record from queue")
        return

    interview_context = InterviewContext.from_supabase_record(interviewer_record)
    logger.info(
        f"Retrieved interview context for {interview_context.candidate_name} (ID: {interview_context.interview_id})"
    )

    stt = DeepgramSTTService(
        api_key=os.getenv("DEEPGRAM_API_KEY"),
        live_options=LiveOptions(model="nova-3"),
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
        model="gemini-1.5-flash",
    )

    # --- Transcript and Shutdown Logic (unchanged) ---
    transcript = TranscriptProcessor()
    session_timestamp = datetime.now(datetime.UTC)
    transcript_path = (
        TRANSCRIPT_BASE_DIR / f"interview-{interview_context.interview_id}.md"
    )
    transcript_initialized = False
    services_shutdown = False

    async def shutdown_services():
        nonlocal services_shutdown
        if services_shutdown:
            return
        services_shutdown = True
        logger.info("Shutting down STT service.")
        try:
            await stt.stop()
            await stt.cleanup()
        except Exception as e:
            logger.exception(f"Failed to stop or clean up STT service: {e}")

        logger.info("Shutting down LLM service.")
        try:
            await llm.stop()
            await llm.cleanup()
        except Exception as e:
            logger.exception(f"Failed to stop or clean up LLM service: {e}")

        logger.info("Shutting down Simli AI service.")
        try:
            await simli_ai.stop()
            await simli_ai.cleanup()
        except Exception as e:
            logger.exception(f"Failed to stop or clean up Simli AI service: {e}")

        logger.info("Shutting down TTS service.")
        try:
            await tts.stop()
            await tts.cleanup()
        except Exception as e:
            logger.exception(f"Failed to stop or clean up TTS service: {e}")

        logger.info("Saving transcript to Supabase.")
        transcript_service = TranscriptService()
        try:
            with open(transcript_path, "r", encoding="utf-8") as f:
                full_text = f.read()
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

    # --- Pipeline Construction with FlowManager ---

    # Create the FlowManager. This will replace the LLMContextAggregatorPair.
    flow_manager = FlowManager(llm=llm)

    # Store the interview context in the flow's state so handlers can access it.
    flow_manager.state["interview_context"] = interview_context

    pipeline_components = [
        transport.input(),
        stt,
        transcript.user(),
        flow_manager,  # Add the FlowManager to the pipeline
        llm,
        tts,
    ]
    if simli_ai:
        pipeline_components.append(simli_ai)
    pipeline_components.extend(
        [
            transport.output(),
            transcript.assistant(),
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

    # --- Event Handlers (Updated for Flows) ---

    @transport.event_handler("on_client_connected")
    async def on_client_connected(transport, client):
        logger.info("Client connected, initializing interview flow.")
        # Instead of just running the LLM, we initialize the flow with the first node.
        initial_node = create_greeting_node(interview_context)
        await flow_manager.initialize(initial_node)

    @transport.event_handler("on_client_disconnected")
    async def on_client_disconnected(transport, client):
        logger.info(f"Client disconnected - ending interview")
        await task.cancel()
        await shutdown_services()

    @transcript.event_handler("on_transcript_update")
    async def handle_transcript_update(processor, frame):
        # ... (transcript update logic is unchanged)
        nonlocal transcript_initialized
        if not frame.messages:
            return
        if not transcript_initialized:
            TRANSCRIPT_BASE_DIR.mkdir(parents=True, exist_ok=True)
            with transcript_path.open("w", encoding="utf-8") as md_file:
                md_file.write(
                    f"# Interview Transcript - {session_timestamp:%Y-%m-%d %H:%M UTC}\n\n"
                    f"**Interview ID:** `{interview_context.interview_id}`\n\n"
                    "## Interview Context\n"
                    f"- **Candidate:** {interview_context.candidate_name}\n"
                    f"- **Position:** {interview_context.job_title}\n"
                    f"- **Status:** In Progress\n\n"
                    "## Transcript\n"
                )
            transcript_initialized = True
        lines = []
        for message in frame.messages:
            role = "Interviewer" if message.role == "assistant" else "Candidate"
            timestamp = message.timestamp or datetime.now(datetime.UTC).isoformat()
            content = message.content.strip().replace("\n", "  \n")
            lines.append(f"- **{timestamp} – {role}:** {content}")
        with transcript_path.open("a", encoding="utf-8") as md_file:
            md_file.write("\n".join(lines) + "\n")

    # --- Run the Pipeline ---
    runner = PipelineRunner(handle_sigint=runner_args.handle_sigint)
    try:
        await runner.run(task)
    finally:
        await shutdown_services()
        if _shutdown_services_callback is shutdown_services:
            _shutdown_services_callback = None


# ----------------------------------------------------------------------------
# 3. ENTRY POINTS (unchanged)
# The code for starting the bot from the CLI or Pipecat Cloud remains the same.
# ----------------------------------------------------------------------------


async def bot(runner_args: RunnerArguments, auth_token: Optional[str] = None):
    """Main bot entry point compatible with Pipecat Cloud."""
    transport = await create_transport(runner_args, transport_params)
    await run_bot(transport, runner_args, auth_token)


async def main():
    """CLI entry point for testing the simlibot"""
    import sys

    if len(sys.argv) < 2:
        print("Usage: python -m interview.bots.simlibot <auth_token>")
        sys.exit(1)
    auth_token = sys.argv[1]
    try:
        os.environ = "webrtc"
        runner_args = RunnerArguments()
        transport = await create_transport(runner_args, transport_params)
        await run_bot(transport, runner_args, auth_token)
    except Exception as e:
        print(f"Error: {e}")
        sys.exit(1)


if __name__ == "__main__":
    import sys

    if len(sys.argv) >= 2 and not sys.argv[1].startswith("--"):
        asyncio.run(main())
    else:
        from pipecat.runner.run import main

        main()
