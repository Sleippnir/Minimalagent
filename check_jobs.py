import supabase
from config import Config

client = supabase.create_client(Config.SUPABASE_URL, Config.SUPABASE_ANON_KEY)
jobs = client.table('jobs').select('*').execute()

print(f'Found {len(jobs.data)} jobs in database')
print('\nCurrent job tags:')
for job in jobs.data:
    print(f'Job: {job}')
    print('---')