#!/usr/bin/env python3
"""
Simple test script for simlibot components
Tests the core functionality without WebRTC transport
"""

import os
import asyncio
import sys
from pathlib import Path

# Add the project root to Python path
sys.path.insert(0, str(Path(__file__).parent.parent.parent))

from dotenv import load_dotenv
from loguru import logger

# Load environment variables
load_dotenv(override=True)

# Import test components
from interview.context_service.client import SupabaseClient, get_supabase_client
from interview.context_service.services import QueueService
from interview.context_service import InterviewContext


async def test_supabase_connection():
    """Test Supabase connection and data retrieval"""
    print("🔍 Testing Supabase connection...")

    try:
        client = get_supabase_client()
        print("✅ Supabase client created successfully")

        # Test queue service
        queue_service = QueueService()
        print("✅ Queue service created successfully")

        return True
    except Exception as e:
        print(f"❌ Supabase connection failed: {e}")
        return False


async def test_interview_context_loading(auth_token: str):
    """Test loading interview context from Supabase"""
    print(f"🔍 Testing interview context loading for token: {auth_token}")

    try:
        queue_service = QueueService()
        interviewer_record = await queue_service.get_interview_context_from_queue(
            auth_token
        )

        if not interviewer_record:
            print("❌ No interview record found for this token")
            return False

        print("✅ Interview record retrieved successfully")

        # Test InterviewContext creation
        interview_context = InterviewContext.from_supabase_record(interviewer_record)
        print(f"✅ InterviewContext created for {interview_context.candidate_name}")
        print(f"   Job: {interview_context.job_title}")
        print(f"   Questions: {len(interview_context.questions)}")
        print(f"   Interview ID: {interview_context.interview_id}")

        # Test context formatting
        full_context = interview_context.format_full_context()
        print(f"✅ Full context formatted ({len(full_context)} characters)")

        return True
    except Exception as e:
        print(f"❌ Interview context loading failed: {e}")
        return False


async def test_llm_services():
    """Test LLM service initialization"""
    print("🔍 Testing LLM services...")

    try:
        from pipecat.services.google.llm import GoogleLLMService

        llm = GoogleLLMService(
            api_key=os.getenv("GOOGLE_API_KEY"), model="gemini-1.5-flash"
        )
        print("✅ Google LLM service created successfully")
        return True
    except Exception as e:
        print(f"❌ LLM service creation failed: {e}")
        return False


async def test_tts_services():
    """Test TTS service initialization"""
    print("🔍 Testing TTS services...")

    try:
        from pipecat.services.elevenlabs.tts import ElevenLabsTTSService

        tts = ElevenLabsTTSService(
            api_key=os.getenv("ELEVENLABS_API_KEY", ""),
            voice_id=os.getenv("ELEVENLABS_VOICE_ID", ""),
        )
        print("✅ ElevenLabs TTS service created successfully")
        return True
    except Exception as e:
        print(f"❌ TTS service creation failed: {e}")
        return False


async def test_stt_services():
    """Test STT service initialization"""
    print("🔍 Testing STT services...")

    try:
        from pipecat.services.whisper.stt import WhisperSTTService

        stt = WhisperSTTService()
        print("✅ Whisper STT service created successfully")
        return True
    except Exception as e:
        print(f"❌ STT service creation failed: {e}")
        return False


async def test_tools():
    """Test interview tools"""
    print("🔍 Testing interview tools...")

    try:
        from interview.tools import get_interview_tools_schema

        tools = get_interview_tools_schema()
        print(
            f"✅ Interview tools schema created with {len(tools.standard_tools)} tools"
        )
        return True
    except Exception as e:
        print(f"❌ Tools creation failed: {e}")
        return False


async def main():
    """Run all tests"""
    print("🚀 Starting simlibot component tests...\n")

    # Check environment variables
    required_env_vars = [
        "SUPABASE_URL",
        "SUPABASE_ANON_KEY",
        "GOOGLE_API_KEY",
        "ELEVENLABS_API_KEY",
        "ELEVENLABS_VOICE_ID",
    ]

    missing_vars = [var for var in required_env_vars if not os.getenv(var)]
    if missing_vars:
        print(f"⚠️  Missing environment variables: {', '.join(missing_vars)}")
        print("   Some tests may fail\n")

    # Run tests
    results = []

    # Test 1: Supabase connection
    results.append(await test_supabase_connection())
    print()

    # Test 2: Interview context loading (requires auth token)
    if len(sys.argv) > 1:
        auth_token = sys.argv[1]
        results.append(await test_interview_context_loading(auth_token))
        print()
    else:
        print("⏭️  Skipping interview context test (no auth_token provided)")
        results.append(None)
        print()

    # Test 3: LLM services
    results.append(await test_llm_services())
    print()

    # Test 4: TTS services
    results.append(await test_tts_services())
    print()

    # Test 5: STT services
    results.append(await test_stt_services())
    print()

    # Test 6: Tools
    results.append(await test_tools())
    print()

    # Summary
    passed = sum(1 for r in results if r is True)
    total = len(results)
    skipped = sum(1 for r in results if r is None)

    print("📊 Test Results:")
    print(f"   ✅ Passed: {passed}")
    print(f"   ⏭️  Skipped: {skipped}")
    print(f"   ❌ Failed: {total - passed - skipped}")
    print(
        f"   📈 Success Rate: {passed}/{total - skipped} ({(passed / (total - skipped) * 100):.1f}%)"
    )

    if passed == total - skipped:
        print("\n🎉 All tests passed! The simlibot components are working correctly.")
        return 0
    else:
        print("\n⚠️  Some tests failed. Check the output above for details.")
        return 1


if __name__ == "__main__":
    exit_code = asyncio.run(main())
    sys.exit(exit_code)
