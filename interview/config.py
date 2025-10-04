"""
Interview Configuration
Centralized configuration for the interview container
"""

import os
from dotenv import load_dotenv
from pathlib import Path

# Load environment variables from project root
PROJECT_ROOT = Path(__file__).parent.parent
load_dotenv(PROJECT_ROOT / '.env', override=True)

class InterviewConfig:
    """Configuration class for interview services"""

    # API Keys
    GOOGLE_API_KEY = os.getenv('GOOGLE_API_KEY')
    DEEPGRAM_API_KEY = os.getenv('DEEPGRAM_API_KEY')
    ELEVENLABS_API_KEY = os.getenv('ELEVENLABS_API_KEY')
    SIMLI_API_KEY = os.getenv('SIMLI_API_KEY')
    OPENAI_API_KEY = os.getenv('OPENAI_API_KEY')
    DEEPSEEK_API_KEY = os.getenv('DEEPSEEK_API_KEY')
    OPENROUTER_API_KEY = os.getenv('OPENROUTER_API_KEY')
    PERPLEXITY_API_KEY = os.getenv('PERPLEXITY_API_KEY')

    # Supabase Configuration
    SUPABASE_URL = os.getenv('SUPABASE_URL')
    SUPABASE_KEY = os.getenv('SUPABASE_KEY')

    # Service Configuration
    LANGUAGE = "en-US"
    SAMPLE_RATE = 16000

    @classmethod
    def validate(cls):
        """Validate that all required environment variables are set"""
        required_vars = [
            'GOOGLE_API_KEY',
            'DEEPGRAM_API_KEY',
            'ELEVENLABS_API_KEY',
            'SIMLI_API_KEY'
        ]

        missing = [var for var in required_vars if not getattr(cls, var)]
        if missing:
            raise ValueError(f"Missing required environment variables: {missing}")

        return True