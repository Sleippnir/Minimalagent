"""
Configuration settings for the Minimalagent project.
Centralizes environment variables and provides typed configuration.
"""

import os
from typing import Optional
from dotenv import load_dotenv

# Load environment variables
load_dotenv(override=True)


class Config:
    """Application configuration"""

    # Supabase settings
    SUPABASE_URL: str = os.getenv("SUPABASE_URL", "")
    SUPABASE_ANON_KEY: str = os.getenv("SUPABASE_ANON_KEY", "")

    # API Keys
    DEEPGRAM_API_KEY: str = os.getenv("DEEPGRAM_API_KEY", "")
    ELEVENLABS_API_KEY: str = os.getenv("ELEVENLABS_API_KEY", "")
    ELEVENLABS_VOICE_ID: str = os.getenv("ELEVENLABS_VOICE_ID", "")
    GOOGLE_API_KEY: str = os.getenv("GOOGLE_API_KEY", "")
    SIMLI_API_KEY: str = os.getenv("SIMLI_API_KEY", "")
    SIMLI_FACE_ID: str = os.getenv("SIMLI_FACE_ID", "")

    # Auth token for testing
    AUTH_TOKEN: str = os.getenv("AUTH_TOKEN", "ff1d3457-2407-4195-b0e3-ee608ecd7e94")

    # Transcript storage
    TRANSCRIPT_BASE_DIR: str = "storage"

    def __init__(self):
        """
        Validate that all required environment-derived configuration values are present on the instance.
        
        Checks for presence of SUPABASE_URL, SUPABASE_ANON_KEY, DEEPGRAM_API_KEY, ELEVENLABS_API_KEY,
        ELEVENLABS_VOICE_ID, GOOGLE_API_KEY, SIMLI_API_KEY, and SIMLI_FACE_ID and raises an error
        if any are missing.
        
        Raises:
            ValueError: If one or more required environment variables are not set; the exception message
            lists the missing variable names.
        """
        required_vars = [
            "SUPABASE_URL",
            "SUPABASE_ANON_KEY",
            "DEEPGRAM_API_KEY",
            "ELEVENLABS_API_KEY",
            "ELEVENLABS_VOICE_ID",
            "GOOGLE_API_KEY",
            "SIMLI_API_KEY",
            "SIMLI_FACE_ID",
        ]

        missing = [var for var in required_vars if not getattr(self, var)]
        if missing:
            raise ValueError(
                f"Missing required environment variables: {', '.join(missing)}"
            )


# Global config instance
config = Config()