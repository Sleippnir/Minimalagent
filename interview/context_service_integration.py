"""
Context Service
Integrated service that combines evaluator, persistence, and context management
"""

from typing import Optional, Dict, Any, List
from datetime import datetime
import asyncio
from .config import InterviewConfig
from .context_service.services import QueueService
from .context_service.interview_repository import InterviewRepository
from .context_service.evaluator_repository import EvaluationRepository
from .evaluator.interview import Interview, Candidate
from .evaluator.helpers import EvaluationHelper


class ContextService:
    """Integrated context service for interview operations"""

    def __init__(self):
        InterviewConfig.validate()  # Ensure configuration is valid
        self.queue_service = QueueService()
        self.interview_repo = InterviewRepository()
        self.evaluator_repo = EvaluationRepository()
        self.evaluation_helper = EvaluationHelper()

    async def get_interview_context(self, auth_token: str) -> Optional[Dict[str, Any]]:
        """Get interview context for a given auth token"""
        return await self.queue_service.get_interview_context_from_queue(auth_token)

    async def get_evaluation_task(self) -> Optional[Dict[str, Any]]:
        """Get next available evaluation task"""
        return await self.queue_service.get_next_evaluation_task()

    async def save_transcript(
        self, interview_id: str, transcript_data: Dict[str, Any]
    ) -> bool:
        """Save interview transcript"""
        try:
            await self.interview_repo.save_transcript(interview_id, transcript_data)
            return True
        except Exception as e:
            print(f"Error saving transcript: {e}")
            return False

    async def save_evaluation(self, evaluation_data: Dict[str, Any]) -> bool:
        """Save evaluation results"""
        try:
            await self.evaluator_repo.save_evaluation(evaluation_data)
            return True
        except Exception as e:
            print(f"Error saving evaluation: {e}")
            return False

    def create_interview(
        self, candidate_data: Dict[str, Any], questions: List[str]
    ) -> Interview:
        """Create a new interview instance"""
        candidate = Candidate(
            first_name=candidate_data.get("first_name", "Unknown"),
            last_name=candidate_data.get("last_name", "Unknown"),
        )

        return Interview(
            candidate=candidate, questions=questions, start_time=datetime.now()
        )

    def evaluate_response(self, question: str, response: str) -> Dict[str, Any]:
        """Evaluate a candidate's response using the evaluation helper"""
        return self.evaluation_helper.evaluate_response(question, response)

    async def get_interview_history(self, candidate_id: str) -> List[Dict[str, Any]]:
        """Get interview history for a candidate"""
        try:
            return await self.interview_repo.get_by_candidate(candidate_id)
        except Exception as e:
            print(f"Error getting interview history: {e}")
            return []

    async def close(self):
        """Clean up resources"""
        # Close any open connections if needed
        pass
