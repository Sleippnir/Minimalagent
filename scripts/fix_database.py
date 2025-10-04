import supabase
from config import Config
from .automated_tagger import AutomatedTagger

def update_all_jobs_with_new_tags():
    """Update all jobs in database with improved automated tags"""
    client = supabase.create_client(Config.SUPABASE_URL, Config.SUPABASE_ANON_KEY)
    tagger = AutomatedTagger()

    # Get all jobs
    jobs = client.table('jobs').select('job_id, title, description, required_tags').execute()

    print(f"Updating {len(jobs.data)} jobs with improved tags...")

    for job in jobs.data:
        # Generate new tags using the improved tagger
        combined_text = f"{job['title']} {job['description']}"
        new_tags = tagger.generate_job_tags(job['title'], job['description'])

        # Update the job with new tags
        client.table('jobs').update({'required_tags': new_tags}).eq('job_id', job['job_id']).execute()

        print(f"✅ Updated {job['title']}: {job['required_tags']} → {new_tags}")

    print("All jobs updated with improved tags!")

def regenerate_job_questions_relationships():
    """Regenerate job_questions table based on tag matching"""
    client = supabase.create_client(Config.SUPABASE_URL, Config.SUPABASE_ANON_KEY)

    # Clear existing relationships
    print("Clearing existing job_questions relationships...")
    client.table('job_questions').delete().neq('job_id', '00000000-0000-0000-0000-000000000000').execute()

    # Get all jobs and questions
    jobs = client.table('jobs').select('job_id, title, required_tags').execute()
    questions = client.table('questions').select('question_id, text, tags, category').execute()

    print(f"Creating new relationships for {len(jobs.data)} jobs and {len(questions.data)} questions...")

    relationships_created = 0

    for job in jobs.data:
        job_tags = set(job['required_tags'])
        job_id = job['job_id']

        # Find questions that match job tags
        matching_questions = []
        for question in questions.data:
            question_tags = set(question['tags'])
            # Calculate overlap
            overlap = len(job_tags.intersection(question_tags))
            if overlap > 0:
                matching_questions.append({
                    'question': question,
                    'overlap': overlap,
                    'total_tags': len(question_tags)
                })

        # Sort by overlap (prioritize questions with more tag matches)
        matching_questions.sort(key=lambda x: (x['overlap'], -x['total_tags']), reverse=True)

        # Select top 6 questions for this job
        selected_questions = matching_questions[:6]

        # Create relationships
        for position, match in enumerate(selected_questions, 1):
            question = match['question']
            client.table('job_questions').insert({
                'job_id': job_id,
                'question_id': question['question_id'],
                'position': position
            }).execute()

            relationships_created += 1
            print(f"✅ {job['title'][:30]} → {question['text'][:50]}... (overlap: {match['overlap']})")

    print(f"\n🎉 Created {relationships_created} job-question relationships!")
    print("Job-questions table has been properly updated!")

if __name__ == "__main__":
    print("🔄 Starting database fix process...")
    print("=" * 50)

    # Step 1: Update all jobs with improved tags
    update_all_jobs_with_new_tags()

    print("\n" + "=" * 50)

    # Step 2: Regenerate job-question relationships
    regenerate_job_questions_relationships()

    print("\n" + "=" * 50)
    print("✅ Database fix complete! All jobs and relationships updated.")