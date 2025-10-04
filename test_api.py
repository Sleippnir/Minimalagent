import asyncio
from interview_api import get_context_service

async def test():
    try:
        print('Testing context service...')
        cs = get_context_service()
        print('Context service created successfully')

        # Test a simple database call
        result = await cs.queue_service.client.get('interviews', {'limit': '1'})
        print(f'Database connection test: {len(result)} records found')

        print('All tests passed!')

    except Exception as e:
        print(f'Error: {e}')
        import traceback
        traceback.print_exc()

if __name__ == "__main__":
    asyncio.run(test())