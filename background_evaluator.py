"""
Background Evaluator Agent
Monitors the evaluator_queue for completed interviews and processes them with LLM evaluation.
"""

import asyncio
import logging
import json
from typing import Dict, Any, Optional, List
from datetime import datetime
import time
import uuid

from interview.config import InterviewConfig
from interview.context_service_integration import ContextService
from interview.context_service.evaluator_repository import (
    Evaluation,
    EvaluationRepository,
)
from interview.evaluator.interview import (
    Interview,
    Candidate,
    Job,
    Rubric,
    EvaluationMaterials,
    TranscriptData,
    TranscriptEntry,
    QuestionAnswer,
)
from interview.evaluator.helpers import EvaluationHelper


class BackgroundEvaluatorAgent:
    """
    Background agent that monitors evaluator_queue and processes completed interviews.

    This agent:
    1. Polls the evaluator_queue table for completed interviews
    2. Converts queue data to Interview objects
    3. Runs LLM evaluation on transcripts
    4. Stores evaluation results in the database
    5. Updates interview status
    """

    def __init__(self):
        InterviewConfig.validate()  # Ensure configuration is valid
        self.context_service = ContextService()
        self.evaluation_helper = EvaluationHelper()
        self.logger = logging.getLogger(__name__)
        self.running = False
        self.poll_interval = 30  # seconds between queue checks

    async def start(self):
        """Start the background evaluator agent"""
        self.running = True
        self.logger.info("Starting Background Evaluator Agent...")

        while self.running:
            try:
                await self._process_pending_evaluations()
                await asyncio.sleep(self.poll_interval)
            except Exception as e:
                self.logger.error(f"Error in evaluation processing loop: {e}")
                await asyncio.sleep(self.poll_interval)

    def stop(self):
        """Stop the background evaluator agent"""
        self.logger.info("Stopping Background Evaluator Agent...")
        self.running = False

    async def _process_pending_evaluations(self):
        """Process all pending evaluations in the queue"""
        try:
            # Get next evaluation task from queue
            evaluation_task = await self.context_service.get_evaluation_task()

            if not evaluation_task:
                # No pending evaluations
                return

            self.logger.info(f"Processing evaluation task: {evaluation_task.get('id')}")

            # Process the evaluation
            success = await self._process_evaluation_task(evaluation_task)

            if success:
                self.logger.info(
                    f"Successfully processed evaluation: {evaluation_task.get('id')}"
                )
            else:
                self.logger.error(
                    f"Failed to process evaluation: {evaluation_task.get('id')}"
                )

        except Exception as e:
            self.logger.error(f"Error processing pending evaluations: {e}")

    async def _process_evaluation_task(self, evaluation_task: Dict[str, Any]) -> bool:
        """
        Process a single evaluation task from the queue

        Args:
            evaluation_task: The evaluation task data from evaluator_queue

        Returns:
            bool: True if processing was successful
        """
        try:
            # Extract interview_id from the evaluation task
            interview_id = evaluation_task.get("interview_id")
            if not interview_id:
                self.logger.error("No interview_id in evaluation task")
                return False

            # Get the payload data (contains all interview information)
            payload = evaluation_task.get("payload", {})
            if not payload:
                self.logger.error("No payload in evaluation task")
                return False

            # Convert payload data directly to Interview object
            interview = self._create_interview_from_payload(payload)

            # Run LLM evaluation
            evaluation_results = await self._run_llm_evaluation(interview)

            # Store evaluation results
            success = await self._store_evaluation_results(
                interview_id, evaluation_results
            )

            return success

        except Exception as e:
            self.logger.error(f"Error processing evaluation task: {e}")
            return False

    def _create_interview_from_payload(self, payload: Dict[str, Any]) -> Interview:
        """
        Create an Interview object from evaluator_queue payload data

        Args:
            payload: The payload data from evaluator_queue containing all interview information

        Returns:
            Interview: Populated Interview object
        """
        # Extract candidate info
        candidate_data = payload.get("candidate", {})
        candidate = Candidate(
            first_name=candidate_data.get("first_name", "Unknown"),
            last_name=candidate_data.get("last_name", "Unknown"),
        )

        # Extract job info
        job_data = payload.get("job", {})
        job = Job(
            title=job_data.get("title", "Unknown Position"),
            description=job_data.get("description", "No description available"),
        )

        # Extract transcript data from payload
        transcript_payload = payload.get("transcript_data", {})
        full_text = transcript_payload.get("full_text_transcript", "")

        # Convert structured transcript to TranscriptEntry objects
        structured_transcript_data = transcript_payload.get("structured_transcript", [])
        structured_transcript = []
        for entry in structured_transcript_data:
            if isinstance(entry, dict):
                structured_transcript.append(
                    TranscriptEntry(
                        speaker=entry.get("speaker", "unknown"),
                        text=entry.get("text", ""),
                    )
                )

        transcript = TranscriptData(
            full_text_transcript=full_text, structured_transcript=structured_transcript
        )

        # Extract evaluation materials from payload
        eval_materials_payload = payload.get("evaluation_materials", {})

        # Use the rubric from payload or create a default one
        rubric_data = eval_materials_payload.get("rubric", {})
        if rubric_data:
            rubric = Rubric.from_dict(rubric_data)
        else:
            # Fallback rubric
            rubric = Rubric(
                name="Technical Interview Rubric",
                version=1,
                criteria={
                    "technical_proficiency": "Understanding of core concepts, problem-solving approach, code quality and efficiency (1-10)",
                    "communication_skills": "Clarity of explanations, ability to articulate thought process, professionalism (1-10)",
                    "cultural_fit": "Alignment with company values, enthusiasm for the role, collaboration mindset (1-10)",
                },
            )

        # Use evaluator prompt from payload or default
        evaluator_prompt = eval_materials_payload.get(
            "evaluator_prompt",
            "You are an expert technical recruiter and hiring manager. "
            "Your task is to evaluate the provided interview transcript based on the "
            "job description and the rubric. Provide a detailed, constructive, and "
            "unbiased evaluation. Assess the candidate's technical skills, "
            "communication abilities, and overall fit for the role. "
            "Provide scores for each category in the rubric and a final summary.",
        )

        evaluation_materials = EvaluationMaterials(
            evaluator_prompt=evaluator_prompt, rubric=rubric
        )

        # Extract questions and answers if available
        questions_answers_data = payload.get("questions_and_answers", [])
        questions_answers = []
        for qa in questions_answers_data:
            if isinstance(qa, dict):
                questions_answers.append(
                    QuestionAnswer(
                        position=qa.get("position", 0),
                        question_text=qa.get("question_text", ""),
                        ideal_answer=qa.get("ideal_answer", ""),
                    )
                )

        # Create the Interview object
        interview = Interview(
            interview_id=payload.get("interview_id", "unknown"),
            candidate=candidate,
            job=job,
            transcript_data=transcript,
            evaluation_materials=evaluation_materials,
        )

        # Add questions and answers if available
        if questions_answers:
            interview.questions_answers = questions_answers

        return interview

    async def _run_llm_evaluation(self, interview: Interview) -> Dict[str, Any]:
        """
        Run LLM evaluation on the interview

        Args:
            interview: The Interview object to evaluate

        Returns:
            Dict containing evaluation results
        """
        try:
            # For now, use the placeholder evaluation
            # TODO: Implement actual LLM API calls (TODO 04 and TODO 05)
            evaluation_result = await self.evaluation_helper.run_full_evaluation(
                {
                    "interview_id": interview.interview_id,
                    "transcript": interview.transcript_data.full_text_transcript,
                    "job_description": interview.job.description,
                    "rubric": interview.evaluation_materials.rubric.to_dict(),
                }
            )

            return {
                "evaluation_1": evaluation_result,  # OpenAI result (placeholder)
                "evaluation_2": evaluation_result,  # Google result (placeholder)
                "evaluation_3": evaluation_result,  # DeepSeek result (placeholder)
                "overall_score": evaluation_result.get("overall_score", 0),
                "recommendation": evaluation_result.get("recommendation", "Unknown"),
                "evaluated_at": datetime.now().isoformat(),
            }

        except Exception as e:
            self.logger.error(f"Error running LLM evaluation: {e}")
            return {
                "error": str(e),
                "overall_score": 0,
                "recommendation": "Evaluation failed",
                "evaluated_at": datetime.now().isoformat(),
            }

    async def _store_evaluation_results(
        self, interview_id: str, evaluation_results: Dict[str, Any]
    ) -> bool:
        """
        Store evaluation results in the evaluator_results table

        Args:
            interview_id: The interview ID
            evaluation_results: The evaluation results to store

        Returns:
            bool: True if storage was successful
        """
        try:
            # Create Evaluation objects for each evaluation
            evaluation_repo = EvaluationRepository()

            # Store evaluation_1 (OpenAI GPT-4o)
            if evaluation_results.get("evaluation_1"):
                eval_data = evaluation_results["evaluation_1"]
                evaluation_1 = Evaluation(
                    interview_id=interview_id,
                    evaluator_llm_model="gpt-4o",
                    score=eval_data.get("overall_score") or eval_data.get("score"),
                    reasoning=eval_data.get("recommendation", ""),
                    raw_llm_response=eval_data,
                )
                await evaluation_repo.create(evaluation_1)

            # Store evaluation_2 (Google Gemini)
            if evaluation_results.get("evaluation_2"):
                eval_data = evaluation_results["evaluation_2"]
                evaluation_2 = Evaluation(
                    interview_id=interview_id,
                    evaluator_llm_model="gemini-2.5-flash",
                    score=eval_data.get("overall_score") or eval_data.get("score"),
                    reasoning=eval_data.get("recommendation", ""),
                    raw_llm_response=eval_data,
                )
                await evaluation_repo.create(evaluation_2)

            # Store evaluation_3 (DeepSeek)
            if evaluation_results.get("evaluation_3"):
                eval_data = evaluation_results["evaluation_3"]
                evaluation_3 = Evaluation(
                    interview_id=interview_id,
                    evaluator_llm_model="deepseek-chat",
                    score=eval_data.get("overall_score") or eval_data.get("score"),
                    reasoning=eval_data.get("recommendation", ""),
                    raw_llm_response=eval_data,
                )
                await evaluation_repo.create(evaluation_3)

            # Update interview status to evaluated
            update_data = {"status": "evaluated"}
            self.context_service.interview_repo.supabase.table("interviews").update(
                update_data
            ).eq("interview_id", interview_id).execute()

            self.logger.info(
                f"Successfully stored evaluation results for interview: {interview_id}"
            )
            return True

        except Exception as e:
            self.logger.error(f"Error storing evaluation results: {e}")
            return False


async def main():
    """Main function to run the background evaluator agent"""
    logging.basicConfig(
        level=logging.INFO,
        format="%(asctime)s - %(name)s - %(levelname)s - %(message)s",
    )

    agent = BackgroundEvaluatorAgent()

    try:
        await agent.start()
    except KeyboardInterrupt:
        agent.stop()
    except Exception as e:
        logging.error(f"Background evaluator agent crashed: {e}")
        agent.stop()


if __name__ == "__main__":
    asyncio.run(main())
