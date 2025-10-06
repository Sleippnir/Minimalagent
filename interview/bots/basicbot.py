import os
import sys
from dotenv import load_dotenv
from loguru import logger
import asyncio
from typing import Optional, Dict, Any, List

# Import Supabase services and models
from ..context_service.services import QueueService
from ..context_service import InterviewContext

# Import Gemini LLM
try:
    import google.generativeai as genai
except ImportError:
    logger.warning("google-generativeai not installed, LLM features will be disabled")
    genai = None

load_dotenv(override=True)


class BasicChatbot:
    """Basic chatbot that retrieves and formats interview context like simlibot"""

    def __init__(self, auth_token: str):
        self.auth_token = auth_token
        self.interview_context: Optional[InterviewContext] = None
        self.llm_model = None
        self.conversation_history = []

        # Initialize Gemini if available
        if genai:
            try:
                api_key = os.getenv("GOOGLE_API_KEY")
                if api_key:
                    genai.configure(api_key=api_key)
                    self.llm_model = genai.GenerativeModel('gemini-2.0-flash-exp')
                else:
                    logger.warning("GOOGLE_API_KEY not found")
            except Exception as e:
                logger.error(f"Failed to initialize Gemini: {e}")
        else:
            logger.warning("google-generativeai not available")

    async def initialize_context(self) -> bool:
        """Retrieve interview context from Supabase"""
        try:
            queue_service = QueueService()
            interviewer_record = await queue_service.get_interview_context_from_queue(self.auth_token)

            if not interviewer_record or not interviewer_record.get('payload'):
                return False

            self.interview_context = InterviewContext.from_supabase_record(interviewer_record)
            return True

        except Exception:
            return False

    async def chat(self, message: str) -> str:
        """Chat using Gemini LLM with the formatted interview context"""
        if not self.interview_context:
            return "Context not initialized. Please call initialize_context() first."

        if not self.llm_model:
            return f"I understand you're interviewing {self.interview_context.candidate_name} for the {self.interview_context.job_title} position. You said: {message}"

        try:
            # Initialize conversation if this is the first message
            if not self.conversation_history:
                formatted_context = self.interview_context.format_full_context()
                self.conversation_history = [
                    {"role": "user", "parts": [{"text": f"START_INTERVIEW\n\n{formatted_context}"}]},
                ]

                # Get initial response from LLM
                response = self.llm_model.generate_content(self.conversation_history)
                initial_response = response.text

                # Add to history
                self.conversation_history.append({"role": "model", "parts": [{"text": initial_response}]})

                return initial_response

            # Add user message to history
            self.conversation_history.append({"role": "user", "parts": [{"text": message}]})

            # Generate response
            response = self.llm_model.generate_content(self.conversation_history)
            bot_response = response.text

            # Add bot response to history
            self.conversation_history.append({"role": "model", "parts": [{"text": bot_response}]})

            return bot_response

        except Exception:
            return f"I apologize, but I encountered an error. You said: {message}"


# CLI usage
async def main():
    """CLI entry point for testing the basic chatbot"""
    import sys

    if len(sys.argv) < 2:
        print("Usage: python -m interview.bots.basicbot <auth_token>")
        sys.exit(1)

    auth_token = sys.argv[1]

    try:
        bot = BasicChatbot(auth_token)
        success = await bot.initialize_context()
        if not success:
            print("Failed to initialize chatbot")
            sys.exit(1)

        print("=== Interview Context Retrieved ===")
        print(f"Interview ID: {bot.interview_context.interview_id}")
        print(f"Candidate: {bot.interview_context.candidate_name}")
        print(f"Job Title: {bot.interview_context.job_title}")
        print(f"Questions: {len(bot.interview_context.questions)}")

        print("\n=== Interactive Chat (type 'quit' to exit) ===")
        while True:
            try:
                message = input("You: ").strip()
                if not message:
                    continue
                if message.lower() in ['quit', 'exit', 'q']:
                    print("Goodbye!")
                    break
                response = await bot.chat(message)
                print(f"Bot: {response}")
            except (KeyboardInterrupt, EOFError):
                print("\nGoodbye!")
                break

    except Exception as e:
        print(f"Error: {e}")
        sys.exit(1)


if __name__ == "__main__":
    asyncio.run(main())