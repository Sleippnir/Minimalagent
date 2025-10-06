"""
Interview Tools for LLM
Tools that can be called by the LLM during interview conversations
"""

import logging
from typing import Optional

from pipecat.frames.frames import TTSSpeakFrame, EndTaskFrame
from pipecat.processors.frame_processor import FrameDirection
from pipecat.services.llm_service import FunctionCallParams
from pipecat.adapters.schemas.function_schema import FunctionSchema
from pipecat.adapters.schemas.tools_schema import ToolsSchema

logger = logging.getLogger(__name__)

# Global reference to context aggregator (set by the bot)
_context_aggregator = None


def set_context_aggregator(aggregator):
    """Set the global context aggregator reference for tool access"""
    global _context_aggregator
    _context_aggregator = aggregator


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
    """Tool for LLM to end the conversation"""
    await params.llm.push_frame(
        TTSSpeakFrame(
            "Okay, thank you for joining us today. I'll be ending the session now."
        ),
        FrameDirection.DOWNSTREAM,
    )
    await params.llm.push_frame(EndTaskFrame(), FrameDirection.UPSTREAM)


# Tool schemas
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


def get_interview_tools_schema() -> ToolsSchema:
    """Get the complete tools schema for interview bots"""
    return ToolsSchema(standard_tools=[clean_context_schema, end_fn_schema])
