#!/usr/bin/env python3
"""
Interview Container Usage Example
Demonstrates how to use the integrated interview system
"""

import asyncio
from interview import InterviewBot, InterviewConfig


async def main():
    """
    Run an example interview flow that validates configuration, drives an InterviewBot with sample candidate data and questions, processes simulated responses, completes the interview, and ensures resources are cleaned up.
    
    This coroutine performs a demonstration sequence: it validates InterviewConfig, instantiates an InterviewBot, starts an interview, processes a set of example responses for each question, completes the interview to obtain a final evaluation, and finally closes the bot. Progress and results are printed to stdout.
    """

    # Validate configuration
    try:
        InterviewConfig.validate()
        print("✓ Configuration validated")
    except ValueError as e:
        print(f"✗ Configuration error: {e}")
        return

    # Create interview bot
    bot = InterviewBot()

    # Example candidate data
    candidate_data = {"first_name": "John", "last_name": "Doe"}

    # Example questions
    questions = [
        "Tell me about yourself",
        "What are your strengths?",
        "Why do you want this position?",
    ]

    try:
        # Start interview
        print("Starting interview...")
        start_result = await bot.start_interview(candidate_data, questions)
        print(f"Interview started: {start_result}")

        # Simulate responses
        responses = [
            "I'm a software engineer with 5 years experience",
            "My strengths are problem-solving and teamwork",
            "I want this position because I'm passionate about AI",
        ]

        # Process each response
        for i, (question, response) in enumerate(zip(questions, responses), 1):
            print(f"\nProcessing Question {i}...")
            result = await bot.process_response(question, response)
            print(f"Response processed: {result['status']}")

        # Complete interview
        print("\nCompleting interview...")
        final_result = await bot.complete_interview()
        print(f"Interview completed: {final_result['status']}")
        print(f"Overall score: {final_result['final_evaluation']['overall_score']}")

    except Exception as e:
        print(f"Error during interview: {e}")

    finally:
        # Clean up
        await bot.close()


if __name__ == "__main__":
    asyncio.run(main())