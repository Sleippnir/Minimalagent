#!/usr/bin/env python3
"""
Test script for the schedule-interview Supabase Edge Function
"""

import os
import requests
import json
from dotenv import load_dotenv

load_dotenv()

# Supabase configuration
SUPABASE_URL = os.getenv('SUPABASE_URL')
SUPABASE_ANON_KEY = os.getenv('SUPABASE_ANON_KEY')

def create_test_application():
    """Create a test application for testing"""
    from supabase import create_client

    client = create_client(SUPABASE_URL, SUPABASE_ANON_KEY)

    # Get existing candidate and job
    candidates = client.table('candidates').select('candidate_id').limit(1).execute()
    jobs = client.table('jobs').select('job_id').limit(1).execute()

    if not candidates.data or not jobs.data:
        raise Exception("Need at least one candidate and one job in the database")

    candidate_id = candidates.data[0]['candidate_id']
    job_id = jobs.data[0]['job_id']

    # Create a new application
    new_app = {
        'candidate_id': candidate_id,
        'job_id': job_id
    }

    result = client.table('applications').insert(new_app).execute()
    if result.data and len(result.data) > 0:
        return result.data[0]['application_id']
    else:
        raise Exception("Failed to create test application")

def get_test_data():
    """Get test data from the database for testing"""
    from supabase import create_client

    client = create_client(SUPABASE_URL, SUPABASE_ANON_KEY)

    # Get all applications
    apps = client.table('applications').select('application_id').execute()
    if not apps.data:
        raise Exception("No applications found in database")

    # Get all interviews to see which applications are used
    interviews = client.table('interviews').select('application_id, interview_id').execute()
    used_app_ids = {i['application_id'] for i in interviews.data}

    # Find applications that don't have interviews
    available_apps = [app for app in apps.data if app['application_id'] not in used_app_ids]

    if not available_apps:
        # Delete one interview to free up an application for testing
        if interviews.data:
            interview_to_delete = interviews.data[0]['interview_id']
            print(f"Deleting interview {interview_to_delete} to free up application for testing...")
            client.table('interviews').delete().eq('interview_id', interview_to_delete).execute()
            # Also delete related records
            client.table('interview_questions').delete().eq('interview_id', interview_to_delete).execute()
            client.table('interviewer_queue').delete().eq('interview_id', interview_to_delete).execute()

            # Now get the freed application
            freed_app_id = interviews.data[0]['application_id']
            application_id = freed_app_id
        else:
            raise Exception("No interviews found to delete")
    else:
        application_id = available_apps[0]['application_id']

    # Get some question IDs (mix of technical and behavioral)
    questions = client.table('questions').select('question_id, category').limit(10).execute()
    if not questions.data:
        raise Exception("No questions found in database")

    question_ids = [q['question_id'] for q in questions.data]

    # For now, use a dummy resume path - in real testing you'd upload a resume
    resume_path = "test_resume.pdf"

    return {
        'application_id': application_id,
        'question_ids': question_ids,
        'resume_path': resume_path
    }

def test_schedule_interview():
    """Test the schedule-interview function"""
    print("Testing schedule-interview function...")

    try:
        # Get test data
        test_data = get_test_data()
        print(f"Using application_id: {test_data['application_id']}")
        print(f"Using {len(test_data['question_ids'])} questions")

        # Call the Edge Function
        url = f"{SUPABASE_URL}/functions/v1/schedule-interview"
        headers = {
            'Authorization': f'Bearer {SUPABASE_ANON_KEY}',
            'Content-Type': 'application/json'
        }

        response = requests.post(url, json=test_data, headers=headers)

        print(f"Response status: {response.status_code}")

        if response.status_code == 200:
            result = response.json()
            print("✅ Interview scheduled successfully!")
            print(f"Interview ID: {result.get('interview_id')}")
            print(f"Message: {result.get('message')}")

            # Verify the interview was created and payload generated
            interview_id = result.get('interview_id')
            if interview_id:
                verify_interview_creation(interview_id)

        else:
            print(f"❌ Failed to schedule interview: {response.text}")

    except Exception as e:
        print(f"❌ Test failed: {e}")

def verify_interview_creation(interview_id):
    """Verify that the interview was created and payload generated"""
    from supabase import create_client

    client = create_client(SUPABASE_URL, SUPABASE_ANON_KEY)

    try:
        # Check if interview exists
        interview = client.table('interviews').select('*').eq('interview_id', interview_id).execute()
        if interview.data:
            print("✅ Interview record created")
        else:
            print("❌ Interview record not found")
            return

        # Check if interviewer_queue entry was created
        queue_entry = client.table('interviewer_queue').select('*').eq('interview_id', interview_id).execute()
        if queue_entry.data:
            print("✅ Interview payload added to interviewer_queue")
            # Print some details
            entry = queue_entry.data[0]
            candidate = entry.get('candidate', {})
            job = entry.get('job', {})
            questions = entry.get('questions', [])
            print(f"  - Candidate: {candidate.get('first_name')} {candidate.get('last_name')}")
            print(f"  - Job: {job.get('title')}")
            print(f"  - Questions: {len(questions)}")
        else:
            print("❌ Interview payload not found in interviewer_queue")

    except Exception as e:
        print(f"❌ Verification failed: {e}")

if __name__ == "__main__":
    test_schedule_interview()