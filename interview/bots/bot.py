"""
Interview Bot
Main bot class that integrates all interview functionality
"""

import asyncio
from typing import Optional, Dict, Any, List
from ..config import InterviewConfig
from ..context_service_integration import ContextService
from ..evaluator_service import InterviewEvaluator


class InterviewBot:
    """Main interview bot that orchestrates the entire interview process"""

    def __init__(self):
        InterviewConfig.validate()
        self.context_service = ContextService()
        self.evaluator = InterviewEvaluator(self.context_service)
        self.current_interview = None

    async def start_interview(self, candidate_data: Dict[str, Any], questions: List[str]) -> Dict[str, Any]:
        """Start a new interview session"""
        try:
            self.current_interview = self.context_service.create_interview(candidate_data, questions)

            return {
                'status': 'started',
                'interview_id': str(self.current_interview.id),
                'candidate': self.current_interview.candidate.to_dict(),
                'questions': questions,
                'total_questions': len(questions)
            }
        except Exception as e:
            return {'status': 'error', 'message': str(e)}

    async def process_response(self, question: str, response: str) -> Dict[str, Any]:
        """Process a candidate's response to a question"""
        if not self.current_interview:
            return {'status': 'error', 'message': 'No active interview'}

        try:
            # Evaluate the response
            evaluation = self.evaluator.evaluate_response(question, response)

            # Add response to interview
            self.current_interview.add_response(question, response, evaluation)

            return {
                'status': 'processed',
                'evaluation': evaluation,
                'question': question,
                'response': response
            }
        except Exception as e:
            return {'status': 'error', 'message': str(e)}

    async def complete_interview(self) -> Dict[str, Any]:
        """Complete the current interview and generate final evaluation"""
        if not self.current_interview:
            return {'status': 'error', 'message': 'No active interview'}

        try:
            # Mark interview as complete
            self.current_interview.complete()

            # Generate final evaluation
            interview_data = {
                'id': str(self.current_interview.id),
                'responses': [r['response'] for r in self.current_interview.responses],
                'questions': [r['question'] for r in self.current_interview.responses]
            }

            final_evaluation = await self.evaluator.evaluate_interview(interview_data)

            # Save transcript
            transcript = self._generate_transcript()
            await self.context_service.save_transcript(str(self.current_interview.id), transcript)

            result = {
                'status': 'completed',
                'interview_id': str(self.current_interview.id),
                'final_evaluation': final_evaluation,
                'transcript': transcript,
                'duration': self.current_interview.get_duration()
            }

            # Clear current interview
            self.current_interview = None

            return result

        except Exception as e:
            return {'status': 'error', 'message': str(e)}

    def _generate_transcript(self) -> str:
        """Generate a transcript of the interview"""
        if not self.current_interview:
            return ""

        transcript_lines = [
            f"Interview Transcript - {self.current_interview.candidate.first_name} {self.current_interview.candidate.last_name}",
            f"Started: {self.current_interview.start_time}",
            f"Completed: {self.current_interview.end_time}",
            ""
        ]

        for i, response in enumerate(self.current_interview.responses, 1):
            transcript_lines.extend([
                f"Question {i}: {response['question']}",
                f"Response: {response['response']}",
                f"Evaluation: {response['evaluation']}",
                ""
            ])

        return "\n".join(transcript_lines)

    async def get_interview_context(self, auth_token: str) -> Optional[Dict[str, Any]]:
        """Get interview context by auth token"""
        return await self.context_service.get_interview_context(auth_token)

    async def close(self):
        """Clean up resources"""
        await self.context_service.close()