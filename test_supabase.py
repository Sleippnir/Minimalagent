import os
from supabase import create_client
from dotenv import load_dotenv

load_dotenv()
client = create_client(os.getenv('SUPABASE_URL'), os.getenv('SUPABASE_ANON_KEY'))

print("Testing Supabase connection...")

try:
    # Test candidates table
    result = client.table('candidates').select('*', count='exact').limit(1).execute()
    print(f"✅ Candidates table: {result.count} records")

    # Test jobs table
    result = client.table('jobs').select('*', count='exact').limit(1).execute()
    print(f"✅ Jobs table: {result.count} records")

    # Test questions table
    result = client.table('questions').select('*', count='exact').limit(1).execute()
    print(f"✅ Questions table: {result.count} records")

    print("\n🚀 Ready to test! Open http://localhost:8080 in your browser")

except Exception as e:
    print(f"❌ Error: {e}")
    print("You may need to set up sample data in Supabase first")