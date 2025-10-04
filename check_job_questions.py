import supabase
from config import Config

client = supabase.create_client(Config.SUPABASE_URL, Config.SUPABASE_ANON_KEY)

# Check if job_questions table exists
try:
    result = client.table('job_questions').select('*', count='exact').limit(1).execute()
    print(f'✅ job_questions table exists: {result.count} records')

    # Show a few records to see the structure
    if result.count > 0:
        records = client.table('job_questions').select('*').limit(5).execute()
        print('\nFirst 5 records:')
        for record in records.data:
            print(record)

except Exception as e:
    print(f'❌ job_questions table error: {e}')

    # Try to see what tables do exist
    try:
        print('\nChecking available tables...')
        # We can't easily list tables with the client, so let's check if there are other relationship tables
        for table_name in ['job_question_mappings', 'question_job_relations', 'job_to_questions']:
            try:
                result = client.table(table_name).select('*', count='exact').limit(1).execute()
                print(f'✅ Found table: {table_name} ({result.count} records)')
            except:
                pass
    except:
        print('Could not check for other tables')