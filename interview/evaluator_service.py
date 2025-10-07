"""
Interview Evaluator
Integrated evaluation service for interview responses
"""

from typing import Dict, Any, List
from datetime import datetime
from .evaluator.interview import Interview
from .evaluator.helpers import EvaluationHelper
from .context_service_integration import ContextService


class InterviewEvaluator:
    """Main evaluator class that integrates all evaluation functionality"""

    def __init__(self, context_service: ContextService = None):
        self.context_service = context_service or ContextService()
        self.evaluation_helper = EvaluationHelper()

    async def evaluate_interview(
        self, interview_data: Dict[str, Any]
    ) -> Dict[str, Any]:
        """Evaluate a complete interview"""
        try:
            interview_id = interview_data.get("id")
            responses = interview_data.get("responses", [])
            questions = interview_data.get("questions", [])

            # Evaluate each response
            evaluations = []
            for i, (question, response) in enumerate(zip(questions, responses)):
                evaluation = self.evaluate_response(question, response)
                evaluations.append(
                    {
                        "question_number": i + 1,
                        "question": question,
                        "response": response,
                        "evaluation": evaluation,
                    }
                )

            # Calculate overall score
            overall_score = self._calculate_overall_score(evaluations)

            result = {
                "interview_id": interview_id,
                "evaluations": evaluations,
                "overall_score": overall_score,
                "recommendation": self._get_recommendation(overall_score),
                "evaluated_at": str(datetime.now()),
            }

            # Save evaluation if interview_id provided
            if interview_id:
                await self.context_service.save_evaluation(result)

            return result

        except Exception as e:
            print(f"Error evaluating interview: {e}")
            return {"error": str(e)}

    def evaluate_response(self, question: str, response: str) -> Dict[str, Any]:
        """Evaluate a single response"""
        return self.evaluation_helper.evaluate_response(question, response)

    def _calculate_overall_score(self, evaluations: List[Dict[str, Any]]) -> float:
        """Calculate overall interview score"""
        if not evaluations:
            return 0.0

        total_score = 0
        for eval_data in evaluations:
            score = eval_data.get("evaluation", {}).get("score", 0)
            total_score += score

        return round(total_score / len(evaluations), 2)

    def _get_recommendation(self, score: float) -> str:
        """Get recommendation based on score"""
        if score >= 8.0:
            return "Strong candidate - recommend for next round"
        elif score >= 6.0:
            return "Good candidate - consider for position"
        elif score >= 4.0:
            return "Average candidate - may need more experience"
        else:
            return "Below expectations - not recommended"

    async def get_pending_evaluations(self) -> List[Dict[str, Any]]:
        """Get pending evaluation tasks"""
        try:
            tasks = []
            while True:
                task = await self.context_service.get_evaluation_task()
                if not task:
                    break
                tasks.append(task)
            return tasks
        except Exception as e:
            print(f"Error getting pending evaluations: {e}")
            return []
