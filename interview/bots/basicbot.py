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
    from google import genai
except ImportError:
    logger.warning("google-genai not installed, LLM features will be disabled")
    genai = None

load_dotenv(override=True)


class BasicChatbot:
    """Basic chatbot that retrieves and formats interview context like simlibot"""

    def __init__(self, auth_token: str):
        """
        Create a BasicChatbot bound to the given authentication token and prepare its runtime state.
        
        Initializes instance attributes used by the chatbot (authentication token, interview context placeholder, optional LLM client, and conversation history). If the Google Gemini client library is available and a GOOGLE_API_KEY environment variable is present, attempts to initialize an LLM client; otherwise leaves the client unset and records an appropriate warning.
         
        Parameters:
        	auth_token (str): Authentication token used to fetch interview context for this chat session.
        """
        self.auth_token = auth_token
        self.interview_context: Optional[InterviewContext] = None
        self.llm_client = None
        self.conversation_history = []

        # Initialize Gemini if available
        if genai:
            try:
                api_key = os.getenv("GOOGLE_API_KEY")
                if api_key:
                    self.llm_client = genai.Client(api_key=api_key)
                else:
                    logger.warning("GOOGLE_API_KEY not found")
            except Exception as e:
                logger.error(f"Failed to initialize Gemini: {e}")
        else:
            logger.warning("google-genai not available")

    async def initialize_context(self) -> bool:
        """
        Fetches the interview context from the queue service (Supabase) and stores it on the instance.
        
        Attempts to retrieve a record using the instance's auth token and convert it into an InterviewContext assigned to `self.interview_context`. Returns whether the operation succeeded.
        
        Returns:
            True if the interview context was retrieved and assigned to `self.interview_context`, False otherwise.
        """
        try:
            queue_service = QueueService()
            interviewer_record = await queue_service.get_interview_context_from_queue(
                self.auth_token
            )

            if not interviewer_record or not interviewer_record.get("payload"):
                return False

            self.interview_context = InterviewContext.from_supabase_record(
                interviewer_record
            )
            return True

        except Exception:
            return False

    async def chat(self, message: str) -> str:
        """
        Send a user message to the interview chatbot and return the bot's reply.
        
        Processes the provided message using the stored interview context and the optional Gemini LLM client, maintaining a per-session conversation history. If the interview context is not initialized, returns an instruction to call initialize_context(). If the LLM client is not available, returns a deterministic fallback string that references the candidate and job title and echoes the user's message. On unexpected errors, returns a brief apology that includes the original user message.
        
        Parameters:
            message (str): The user's chat message to send to the bot.
        
        Returns:
            str: The chatbot's reply. This may be:
                - "Context not initialized. Please call initialize_context() first." if context is missing,
                - a deterministic fallback mentioning the candidate and job title when the LLM client is unavailable,
                - the model-generated response when the LLM is used,
                - or an apology message containing the original user message if an error occurs.
        """
        if not self.interview_context:
            return "Context not initialized. Please call initialize_context() first."

        if not self.llm_client:
            return f"I understand you're interviewing {self.interview_context.candidate_name} for the {self.interview_context.job_title} position. You said: {message}"

        try:
            # Initialize conversation if this is the first message
            if not self.conversation_history:
                formatted_context = self.interview_context.format_full_context()
                self.conversation_history = [
                    {
                        "role": "user",
                        "parts": [{"text": f"START_INTERVIEW\n\n{formatted_context}"}],
                    },
                ]

                # Get initial response from LLM
                response = await self.llm_client.aio.models.generate_content(
                    model="gemini-2.0-flash-exp", contents=self.conversation_history
                )
                initial_response = response.text

                # Add to history
                self.conversation_history.append(
                    {"role": "model", "parts": [{"text": initial_response}]}
                )

                return initial_response

            # Add user message to history
            self.conversation_history.append(
                {"role": "user", "parts": [{"text": message}]}
            )

            # Generate response
            response = await self.llm_client.aio.models.generate_content(
                model="gemini-2.0-flash-exp", contents=self.conversation_history
            )
            bot_response = response.text

            # Add bot response to history
            self.conversation_history.append(
                {"role": "model", "parts": [{"text": bot_response}]}
            )

            return bot_response

        except Exception:
            return f"I apologize, but I encountered an error. You said: {message}"


# CLI usage
async def main():
    """
    Run an interactive command-line session that loads interview context and chats with BasicChatbot.
    
    This CLI expects an authentication token as the first command-line argument. It initializes a BasicChatbot with that token, loads interview context, prints a brief summary of the retrieved context (interview ID, candidate, job title, question count), and enters a REPL-style loop reading user messages and printing bot responses until the user types a quit command or triggers an interrupt. Exits with a non-zero status on initialization failure or unhandled errors.
    """
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
                if message.lower() in ["quit", "exit", "q"]:
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