"""
Simple Supabase operations for the evaluator service.
Handles the 4 core operations: get interview queue, get evaluator queue, write transcript, write evaluation.
"""

from typing import Optional, Dict, Any
from .client import get_supabase_client


class QueueService:
    """Service for retrieving formed JSON from queue tables via edge functions"""

    def __init__(self):
        self.client = get_supabase_client()

    async def get_interview_from_queue(
        self, auth_token: str
    ) -> Optional[Dict[str, Any]]:
        """Retrieve formed interview JSON from evaluator queue by auth token"""
        try:
            # This queries the evaluator_queue which gets populated after interviews are complete
            results = await self.client.get(
                "evaluator_queue", {"auth_token": auth_token}
            )

            if results:
                return results[0]  # The formed JSON from edge function
            return None

        except Exception as e:
            print(f"Error getting interview from evaluator queue: {e}")
            return None

    async def get_interview_context_from_queue(
        self, auth_token: str
    ) -> Optional[Dict[str, Any]]:
        """Retrieve interview context from interviewer_queue by auth token"""
        try:
            results = await self.client.get(
                "interviewer_queue", {"auth_token": auth_token}
            )

            if results:
                return results[0]  # The interview context
            return None

        except Exception as e:
            print(f"Error getting interview context from interviewer_queue: {e}")
            return None

    async def get_next_evaluation_task(self) -> Optional[Dict[str, Any]]:
        """Get the next available evaluation task from evaluator_queue"""
        try:
            # Get the oldest unprocessed evaluation task
            results = await self.client.get(
                "evaluator_queue", {"limit": 1, "order": "created_at"}
            )

            if results:
                return results[0]  # The next evaluation task
            return None

        except Exception as e:
            print(f"Error getting next evaluation task: {e}")
            return None

    async def get_evaluator_from_queue(
        self, interview_id: str
    ) -> Optional[Dict[str, Any]]:
        """Retrieve formed evaluator JSON from queue by interview_id"""
        try:
            # This would call your edge function that forms the evaluator JSON
            results = await self.client.get(
                "evaluator_queue", {"interview_id": interview_id}
            )

            if results:
                return results[0]  # The formed JSON from edge function
            return None

        except Exception as e:
            print(f"Error getting evaluator from queue: {e}")
            return None


class TranscriptService:
    """Service for writing to transcripts table"""

    def __init__(self):
        self.client = get_supabase_client()

    async def write_transcript(
        self,
        interview_id: str,
        full_text: str,
        transcript_json: Dict[str, Any],
        audio_path: str = None,
    ) -> bool:
        """Write finalized interview to transcripts table AND update interviews status to completed"""
        transcript_success = False
        status_update_success = False

        try:
            # Step 1: Insert transcript data
            transcript_data = {
                "interview_id": interview_id,
                "full_text": full_text,
                "transcript_json": transcript_json,
            }

            # Only include audio_path if provided
            if audio_path:
                transcript_data["audio_path"] = audio_path

            await self.client.post("transcripts", transcript_data)
            print(f"✅ Successfully inserted transcript for interview {interview_id}")
            transcript_success = True

        except Exception as e:
            print(f"❌ Error inserting transcript: {e}")
            return False

        try:
            # Step 2: Update interviews table status from 'scheduled' to 'completed'
            # This might fail due to RLS policies on the interviews table
            status_update = {"status": "completed"}

            await self.client.patch(
                "interviews", {"interview_id": interview_id}, status_update
            )
            print(
                f"✅ Successfully updated interviews table record {interview_id} status to 'completed'"
            )
            status_update_success = True

        except Exception as e:
            print(f"⚠️ Could not update interview status (likely RLS restriction): {e}")
            print(
                f"💡 Transcript was saved successfully. Status update requires proper permissions."
            )
            status_update_success = False

        # Return True if transcript was saved (the critical operation)
        if transcript_success:
            if status_update_success:
                print(f"🎉 Complete success: Transcript saved AND status updated")
            else:
                print(
                    f"⚠️ Partial success: Transcript saved but status update failed due to permissions"
                )
            return True
        else:
            return False


class EvaluationService:
    """Service for writing to evaluations table"""

    def __init__(self):
        self.client = get_supabase_client()

    async def write_evaluation(
        self,
        interview_id: str,
        evaluator_llm_model: str,
        score: float,
        reasoning: str,
        raw_llm_response: Dict[str, Any],
    ) -> bool:
        """Write finalized evaluation to evaluations table AND update interview status to evaluated"""
        try:
            # Step 1: Insert evaluation data
            evaluation_data = {
                "interview_id": interview_id,
                "evaluator_llm_model": evaluator_llm_model,
                "score": score,
                "reasoning": reasoning,
                "raw_llm_response": raw_llm_response,
            }

            await self.client.post("evaluations", evaluation_data)
            print(
                f"✅ Successfully inserted {evaluator_llm_model} evaluation for interview {interview_id}"
            )

            # Step 2: Check if this is the final evaluation (all 3 providers completed)
            # Get all evaluations for this interview
            existing_evaluations = await self.client.get(
                "evaluations", {"interview_id": interview_id}
            )

            # Count unique evaluator models
            unique_models = set()
            for evaluation in existing_evaluations:
                model = evaluation.get("evaluator_llm_model")
                if model:
                    unique_models.add(model)

            # If we have all 3 evaluations, update interview status to 'evaluated'
            if len(unique_models) >= 3:
                print(
                    f"🎯 All evaluations complete for interview {interview_id}, updating status to 'evaluated'"
                )

                status_update = {"status": "evaluated"}

                await self.client.patch(
                    "interviews", {"interview_id": interview_id}, status_update
                )
                print(
                    f"✅ Successfully updated interview {interview_id} status to 'evaluated'"
                )
            else:
                print(
                    f"📊 {len(unique_models)}/3 evaluations completed for interview {interview_id}"
                )

            return True

        except Exception as e:
            print(f"Error writing evaluation and updating status: {e}")
            return False
