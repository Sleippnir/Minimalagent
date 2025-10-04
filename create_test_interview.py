import asyncio
import uuid
from datetime import datetime
from interview.context_service_integration import ContextService

async def create_test_interview():
    auth_token = str(uuid.uuid4())
    interview_id = str(uuid.uuid4())

    mock_interview_context = {
        'interview_id': interview_id,
        'auth_token': auth_token,
        'candidate': {
            'first_name': 'Test',
            'last_name': 'User',
            'email': 'test@example.com'
        },
        'job': {
            'title': 'Test Developer',
            'description': 'Test job description.'
        },
        'questions': [
            {'question_id': 'q1', 'text': 'Tell me about yourself.'}
        ],
        'created_at': datetime.now().isoformat()
    }

    context_service = ContextService()
    # Try to insert into interviewer_queue
    try:
        from supabase import create_client
        import os
        from dotenv import load_dotenv
        load_dotenv()

        client = create_client(os.getenv('SUPABASE_URL'), os.getenv('SUPABASE_ANON_KEY'))
        result = await client.table('interviewer_queue').insert(mock_interview_context).execute()
        print(f'✅ Created test interview with auth_token: {auth_token}')
        print(f'Interview ID: {interview_id}')
        return auth_token
    except Exception as e:
        print(f'❌ Failed to create interview: {e}')
        return None

if __name__ == "__main__":
    auth_token = asyncio.run(create_test_interview())
    if auth_token:
        print(f'\n🔗 Test the API with: curl "http://localhost:8001/interviews/{auth_token}?launch_bot=true"')