import supabase
from config import Config

client = supabase.create_client(Config.SUPABASE_URL, Config.SUPABASE_ANON_KEY)

# Check questions table structure
questions = client.table('questions').select('*').limit(1).execute()
if questions.data:
    print('Questions table structure:')
    for key in questions.data[0].keys():
        print(f'  {key}: {type(questions.data[0][key])}')
else:
    print('No questions found')