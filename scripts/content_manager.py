"""
Content Management System for maintaining tag consistency and job-question relationships.
This module provides utilities to ensure jobs and questions remain properly matched.
"""
import supabase
from config import Config
from .automated_tagger import AutomatedTagger
from typing import List, Dict, Tuple
import logging

logging.basicConfig(level=logging.INFO)
logger = logging.getLogger(__name__)

class ContentManager:
    """Manages content consistency and relationships between jobs and questions."""

    def __init__(self):
        self.client = supabase.create_client(Config.SUPABASE_URL, Config.SUPABASE_ANON_KEY)
        self.tagger = AutomatedTagger()

    def validate_job_tags(self, job_id: str) -> Dict:
        """Validate that a job's tags follow the unified taxonomy."""
        job = self.client.table('jobs').select('title, description, required_tags').eq('job_id', job_id).execute()

        if not job.data:
            return {'valid': False, 'error': 'Job not found'}

        job_data = job.data[0]
        current_tags = set(job_data['required_tags'])

        # Generate expected tags
        expected_tags = self.tagger.generate_job_tags(job_data['title'], job_data['description'])
        expected_set = set(expected_tags)

        # Check for missing important tags
        missing_tags = expected_set - current_tags
        extra_tags = current_tags - expected_set

        return {
            'valid': len(missing_tags) == 0,
            'current_tags': list(current_tags),
            'expected_tags': expected_tags,
            'missing_tags': list(missing_tags),
            'extra_tags': list(extra_tags)
        }

    def validate_question_tags(self, question_id: str) -> Dict:
        """Validate that a question's tags follow the unified taxonomy."""
        question = self.client.table('questions').select('text, category, tags').eq('question_id', question_id).execute()

        if not question.data:
            return {'valid': False, 'error': 'Question not found'}

        question_data = question.data[0]
        current_tags = set(question_data['tags'])

        # Generate expected tags
        expected_tags = self.tagger.generate_question_tags(question_data['text'], question_data['category'])
        expected_set = set(expected_tags)

        # Check for missing important tags
        missing_tags = expected_set - current_tags
        extra_tags = current_tags - expected_set

        return {
            'valid': len(missing_tags) == 0,
            'current_tags': list(current_tags),
            'expected_tags': expected_tags,
            'missing_tags': list(missing_tags),
            'extra_tags': list(extra_tags)
        }

    def fix_job_tags(self, job_id: str) -> Dict:
        """Fix a job's tags to match the automated tagger."""
        validation = self.validate_job_tags(job_id)
        if validation['valid']:
            return {'updated': False, 'message': 'Tags already valid'}

        # Update job with correct tags
        self.client.table('jobs').update({
            'required_tags': validation['expected_tags']
        }).eq('job_id', job_id).execute()

        logger.info(f"Fixed tags for job {job_id}: {validation['current_tags']} → {validation['expected_tags']}")

        return {
            'updated': True,
            'old_tags': validation['current_tags'],
            'new_tags': validation['expected_tags']
        }

    def fix_question_tags(self, question_id: str) -> Dict:
        """Fix a question's tags to match the automated tagger."""
        validation = self.validate_question_tags(question_id)
        if validation['valid']:
            return {'updated': False, 'message': 'Tags already valid'}

        # Update question with correct tags
        self.client.table('questions').update({
            'tags': validation['expected_tags']
        }).eq('question_id', question_id).execute()

        logger.info(f"Fixed tags for question {question_id}: {validation['current_tags']} → {validation['expected_tags']}")

        return {
            'updated': True,
            'old_tags': validation['current_tags'],
            'new_tags': validation['expected_tags']
        }

    def validate_relationships(self, job_id: str) -> Dict:
        """Validate that a job's question relationships are optimal."""
        # Get job tags
        job = self.client.table('jobs').select('required_tags').eq('job_id', job_id).execute()
        if not job.data:
            return {'valid': False, 'error': 'Job not found'}

        job_tags = set(job.data[0]['required_tags'])

        # Get current relationships
        relationships = self.client.table('job_questions').select('question_id, position').eq('job_id', job_id).execute()

        total_overlap = 0
        issues = []

        for rel in relationships.data:
            question = self.client.table('questions').select('tags').eq('question_id', rel['question_id']).execute()
            if question.data:
                question_tags = set(question.data[0]['tags'])
                overlap = len(job_tags.intersection(question_tags))
                total_overlap += overlap

                if overlap == 0:
                    issues.append(f"Question {rel['question_id']} has no tag overlap")

        avg_overlap = total_overlap / len(relationships.data) if relationships.data else 0

        return {
            'valid': len(issues) == 0 and avg_overlap >= 2,
            'average_overlap': avg_overlap,
            'total_questions': len(relationships.data),
            'issues': issues
        }

    def refresh_job_relationships(self, job_id: str) -> Dict:
        """Refresh question relationships for a specific job."""
        # Get job details
        job = self.client.table('jobs').select('title, required_tags').eq('job_id', job_id).execute()
        if not job.data:
            return {'error': 'Job not found'}

        job_data = job.data[0]
        job_tags = set(job_data['required_tags'])

        # Get all questions
        questions = self.client.table('questions').select('question_id, text, tags, category').execute()

        # Find best matching questions
        matching_questions = []
        for question in questions.data:
            question_tags = set(question['tags'])
            overlap = len(job_tags.intersection(question_tags))
            if overlap > 0:
                matching_questions.append({
                    'question': question,
                    'overlap': overlap,
                    'total_tags': len(question_tags)
                })

        # Sort by overlap and select top 6
        matching_questions.sort(key=lambda x: (x['overlap'], -x['total_tags']), reverse=True)
        selected_questions = matching_questions[:6]

        # Remove existing relationships
        self.client.table('job_questions').delete().eq('job_id', job_id).execute()

        # Create new relationships
        for position, match in enumerate(selected_questions, 1):
            self.client.table('job_questions').insert({
                'job_id': job_id,
                'question_id': match['question']['question_id'],
                'position': position
            }).execute()

        logger.info(f"Refreshed {len(selected_questions)} relationships for job {job_id}")

        return {
            'updated': True,
            'questions_added': len(selected_questions),
            'average_overlap': sum(m['overlap'] for m in selected_questions) / len(selected_questions)
        }

    def audit_content_consistency(self) -> Dict:
        """Audit all content for tag consistency and relationship quality."""
        logger.info("Starting content consistency audit...")

        # Check all jobs
        jobs = self.client.table('jobs').select('job_id, title').execute()
        job_issues = []

        for job in jobs.data:
            validation = self.validate_job_tags(job['job_id'])
            if not validation['valid']:
                job_issues.append({
                    'job_id': job['job_id'],
                    'title': job['title'],
                    'issues': validation
                })

        # Check all questions
        questions = self.client.table('questions').select('question_id, text').execute()
        question_issues = []

        for question in questions.data:
            validation = self.validate_question_tags(question['question_id'])
            if not validation['valid']:
                question_issues.append({
                    'question_id': question['question_id'],
                    'text': question['text'][:50],
                    'issues': validation
                })

        # Check relationships
        relationship_issues = []
        for job in jobs.data:
            rel_validation = self.validate_relationships(job['job_id'])
            if not rel_validation['valid']:
                relationship_issues.append({
                    'job_id': job['job_id'],
                    'title': job['title'],
                    'issues': rel_validation
                })

        return {
            'total_jobs': len(jobs.data),
            'total_questions': len(questions.data),
            'job_issues': job_issues,
            'question_issues': question_issues,
            'relationship_issues': relationship_issues,
            'overall_health': 'good' if not (job_issues or question_issues or relationship_issues) else 'needs_attention'
        }

    def bulk_fix_content(self) -> Dict:
        """Fix all content issues found in audit."""
        audit = self.audit_content_consistency()

        fixed_jobs = 0
        fixed_questions = 0
        fixed_relationships = 0

        # Fix job tags
        for issue in audit['job_issues']:
            self.fix_job_tags(issue['job_id'])
            fixed_jobs += 1

        # Fix question tags
        for issue in audit['question_issues']:
            self.fix_question_tags(issue['question_id'])
            fixed_questions += 1

        # Fix relationships (only for jobs that had tag issues)
        job_ids_to_refresh = {issue['job_id'] for issue in audit['job_issues'] + audit['relationship_issues']}
        for job_id in job_ids_to_refresh:
            self.refresh_job_relationships(job_id)
            fixed_relationships += 1

        logger.info(f"Bulk fix complete: {fixed_jobs} jobs, {fixed_questions} questions, {fixed_relationships} relationships")

        return {
            'jobs_fixed': fixed_jobs,
            'questions_fixed': fixed_questions,
            'relationships_fixed': fixed_relationships
        }


# Utility functions for API integration
def validate_new_job_tags(title: str, description: str) -> List[str]:
    """Generate validated tags for a new job."""
    tagger = AutomatedTagger()
    return tagger.generate_job_tags(title, description)

def validate_new_question_tags(text: str, category: str) -> List[str]:
    """Generate validated tags for a new question."""
    tagger = AutomatedTagger()
    return tagger.generate_question_tags(text, category)

def ensure_job_question_consistency(job_id: str) -> bool:
    """Ensure a job's question relationships are optimal."""
    manager = ContentManager()
    validation = manager.validate_relationships(job_id)
    if not validation['valid']:
        manager.refresh_job_relationships(job_id)
        return True
    return False