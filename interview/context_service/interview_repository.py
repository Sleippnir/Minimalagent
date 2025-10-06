"""
Interview repository implementation using Supabase.
Handles CRUD operations for Interview entities.
"""

from typing import Optional, List, Dict, Any
from ..evaluator.interview import Interview
from .base_repository import SupabaseBaseRepository


class InterviewRepository(SupabaseBaseRepository[Interview]):
    """Repository for managing Interview entities in Supabase"""

    def __init__(self):
        super().__init__(table_name="interviews")

    def to_dict(self, interview: Interview) -> Dict[str, Any]:
        """Convert Interview entity to dictionary for Supabase storage"""
        return interview.to_dict()

    def from_dict(self, data: Dict[str, Any]) -> Interview:
        """Convert Supabase data to Interview entity"""
        return Interview.from_dict(data)

    async def get_by_interview_id(self, interview_id: str) -> Optional[Interview]:
        """Get interview by interview_id field (not primary key)"""
        try:
            result = (
                self.supabase.table(self.table_name)
                .select("*")
                .eq("interview_id", interview_id)
                .execute()
            )

            if result.data:
                return self.from_dict(result.data[0])
            return None

        except Exception as e:
            self.logger.error(f"Error retrieving interview by interview_id: {e}")
            raise Exception(f"Database error: {e}")

    async def get_transcript(self, interview_id: str) -> Optional[Dict[str, Any]]:
        """Get transcript data for an interview"""
        try:
            result = (
                self.supabase.table("transcripts")
                .select("*")
                .eq("interview_id", interview_id)
                .execute()
            )

            if result.data:
                return result.data[0]  # Return the transcript data
            return None

        except Exception as e:
            self.logger.error(f"Error retrieving transcript: {e}")
            raise Exception(f"Database error: {e}")
        """Update interview using interview_id field"""
        try:
            data = self.to_dict(interview)
            result = (
                self.supabase.table(self.table_name)
                .update(data)
                .eq("interview_id", interview.interview_id)
                .execute()
            )

            if result.data:
                return self.from_dict(result.data[0])
            else:
                raise Exception("Failed to update interview record")

        except Exception as e:
            self.logger.error(f"Error updating interview: {e}")
            raise Exception(f"Database error: {e}")

    async def save_transcript(
        self, interview_id: str, transcript_data: Dict[str, Any]
    ) -> bool:
        """Save transcript data to transcripts table"""
        try:
            # Insert into transcripts table
            result = (
                self.supabase.table("transcripts")
                .insert(
                    {
                        "interview_id": interview_id,
                        "transcript_json": transcript_data["transcript_json"],
                        "full_text": transcript_data["full_text"],
                    }
                )
                .execute()
            )

            if result.data:
                # Update interview status to completed
                self.supabase.table(self.table_name).update(
                    {"status": "completed", "completed_at": "now()"}
                ).eq("interview_id", interview_id).execute()

                return True
            return False

        except Exception as e:
            self.logger.error(f"Error saving transcript: {e}")
            raise Exception(f"Database error: {e}")

    async def get_by_status(self, has_evaluations: bool = None) -> List[Interview]:
        """Get interviews filtered by evaluation status"""
        try:
            query = self.supabase.table(self.table_name).select("*")

            if has_evaluations is True:
                # Get interviews that have at least one evaluation
                query = query.not_.is_("evaluation_1", "null")
            elif has_evaluations is False:
                # Get interviews that have no evaluations
                query = (
                    query.is_("evaluation_1", "null")
                    .is_("evaluation_2", "null")
                    .is_("evaluation_3", "null")
                )

            result = query.execute()
            return [self.from_dict(data) for data in result.data]

        except Exception as e:
            self.logger.error(f"Error filtering interviews by status: {e}")
            raise Exception(f"Database error: {e}")


# Backward compatibility functions
async def load_interview_from_supabase(interview_id: str) -> Optional[Interview]:
    """Load interview from Supabase (backward compatibility function)"""
    repository = InterviewRepository()
    return await repository.get_by_interview_id(interview_id)


async def save_interview_to_supabase(interview: Interview) -> Interview:
    """Save interview to Supabase (backward compatibility function)"""
    repository = InterviewRepository()

    # Check if interview exists
    existing = await repository.get_by_interview_id(interview.interview_id)

    if existing:
        return await repository.update_by_interview_id(interview)
    else:
        return await repository.create(interview)
