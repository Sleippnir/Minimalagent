"""
Test script to load and examine interview context with a specific auth_token
"""

import asyncio
import json
from interview.context_service_integration import ContextService


async def test_context_loading():
    """Test loading interview context and examine its structure"""

    auth_token = "7b5fe737-a9fc-4e5f-8fb5-4334b3bcd4aa"

    print(f"🔍 Testing context loading with auth_token: {auth_token}")
    print("=" * 60)

    context_service = ContextService()

    # Try loading from interviewer_queue first
    print("📋 Checking interviewer_queue...")
    interview_context = await context_service.get_interview_context(auth_token)

    if interview_context:
        print("✅ Found context in interviewer_queue!")
        print("\n📊 Interview Context Structure:")
        print(json.dumps(interview_context, indent=2, default=str))
    else:
        print("❌ No context found in interviewer_queue")

        # Try evaluator_queue
        print("\n📋 Checking evaluator_queue...")
        try:
            eval_task = await context_service.queue_service.get_interview_from_queue(auth_token)
            if eval_task:
                print("✅ Found context in evaluator_queue!")
                interview_context = eval_task
                print("\n📊 Evaluation Task Structure:")
                print(json.dumps(interview_context, indent=2, default=str))
            else:
                print("❌ No context found in evaluator_queue either")
        except Exception as e:
            print(f"❌ Error checking evaluator_queue: {e}")

    # If we found context, analyze its structure
    if interview_context:
        print("\n🔍 Structure Analysis:")
        print(f"📝 Keys: {list(interview_context.keys())}")

        for key, value in interview_context.items():
            if isinstance(value, dict):
                print(f"  📁 {key}: dict with keys {list(value.keys())}")
            elif isinstance(value, list):
                print(f"  📋 {key}: list with {len(value)} items")
                if value and isinstance(value[0], dict):
                    print(f"    First item keys: {list(value[0].keys())}")
            else:
                print(f"  📄 {key}: {type(value).__name__} = {value}")

    print("\n" + "=" * 60)
    print("Context examination complete!")


if __name__ == "__main__":
    asyncio.run(test_context_loading())