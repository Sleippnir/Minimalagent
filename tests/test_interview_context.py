#!/usr/bin/env python3
"""
Test script for interview context retrieval and formatting.
Uses EXACTLY the         print("LLM SYSTEM MESSAGE (what the LLM actually receives):")
        print("-" * 70)
        print(f"Role: system")
        print(f"Content: {full_system_prompt}")
        print("-" * 70)

        print("=" * 60)
        print("Context retrieval and formatting test completed successfully!")

    except Exception as e:
        print(f"Error during context retrieval: {e}")
        import traceback
        traceback.print_exc()simlibot.py to show what the LLM receives.
Takes an auth token as argument and prints the retrieved interview context.
"""

import asyncio
import sys
import os
import json
from pathlib import Path

# Add the project root to Python path
project_root = Path(__file__).parent.parent
sys.path.insert(0, str(project_root))

from interview.context_service.services import QueueService


async def test_interview_context_retrieval(auth_token: str):
    """Test the complete interview context retrieval and formatting process."""

    try:
        # Initialize the queue service
        queue_service = QueueService()

        # Retrieve interview context from queue
        interview_context = await queue_service.get_interview_context_from_queue(auth_token)

        if interview_context is None:
            print("No interview context found for the provided auth token")
            return

        # Extract fields using the EXACT same logic as simlibot.py
        interview_id = interview_context.get('interview_id')
        payload = interview_context.get('payload', {})

        candidate_info = payload.get('candidate', {})
        candidate_name = candidate_info.get('first_name', 'Candidate')

        job_info = payload.get('job', {})
        job_title = job_info.get('title', 'Position')

        questions = payload.get('questions', [])
        evaluation_materials = payload.get('evaluation_materials', {})
        resume_text = evaluation_materials.get('resume_text')
        job_description = evaluation_materials.get('job_description')
        interviewer_prompt_raw = payload.get('interviewer_prompt')

        # Apply EXACT same variable replacement as simlibot.py
        interviewer_prompt_processed = interviewer_prompt_raw
        if interviewer_prompt_processed and candidate_name:
            interviewer_prompt_processed = interviewer_prompt_processed.replace('[first_name]', candidate_name)
            interviewer_prompt_processed = interviewer_prompt_processed.replace('[job_title]', job_title)

        # Add ALL extracted context to the system message (exactly like test script)
        context_text = f"\n## Part 9: Interview Context Details\n"
        context_text += f"- Interview ID: {interview_id}\n"
        context_text += f"- Candidate: {candidate_name}\n"
        context_text += f"- Job Title: {job_title}\n"
        context_text += f"- Questions Count: {len(questions)}\n"
        context_text += f"- Resume Text: {resume_text[:200] + '...' if resume_text and len(resume_text) > 200 else resume_text}\n"
        context_text += f"- Job Description: {job_description[:500] + '...' if job_description and len(job_description) > 500 else job_description}\n"

        questions_text = "\n## Part 10: Interview Questions\n"
        for i, question in enumerate(questions, 1):
            questions_text += f"{i}. {question.get('text', 'N/A')} (Type: {question.get('type', 'N/A')})\n"

        # Append all context to the interviewer prompt
        full_system_prompt = interviewer_prompt_processed + context_text + questions_text

        # Print only what the LLM receives
        print(full_system_prompt)

    except Exception as e:
        print(f"Error during context retrieval: {e}")
        import traceback
        traceback.print_exc()


async def main():
    """Main function to handle command line arguments."""
    if len(sys.argv) != 2:
        print("Usage: python test_interview_context.py <auth_token>")
        print("Example: python test_interview_context.py abc123def456")
        sys.exit(1)

    auth_token = sys.argv[1]

    # Load environment variables
    from dotenv import load_dotenv
    load_dotenv()

    # Run the test
    await test_interview_context_retrieval(auth_token)


if __name__ == "__main__":
    asyncio.run(main())