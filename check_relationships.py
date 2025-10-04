import supabase
from config import Config

client = supabase.create_client(Config.SUPABASE_URL, Config.SUPABASE_ANON_KEY)

# Get a few job-question relationships
job_questions = client.table('job_questions').select('job_id, question_id, position').limit(10).execute()

print('Checking job-question relationships:')
for jq in job_questions.data:
    # Get job details
    job = client.table('jobs').select('title, required_tags').eq('job_id', jq['job_id']).execute()
    # Get question details  
    question = client.table('questions').select('text, tags').eq('question_id', jq['question_id']).execute()
    
    if job.data and question.data:
        job_data = job.data[0]
        question_data = question.data[0]

        print(f'\nJob: {job_data["title"]}')
        print(f'Job tags: {job_data["required_tags"]}')
        print(f'Question: {question_data["text"][:100]}...')
        print(f'Question tags: {question_data["tags"]}')
        print(f'Position: {jq["position"]}')
        print('---')