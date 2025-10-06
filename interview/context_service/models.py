"""
Context models and data structures for interview context handling
"""

from typing import Dict, Any, List
from dataclasses import dataclass, field


@dataclass
class InterviewContext:
    """Structured representation of interview context data"""

    interview_id: str = ""
    candidate_info: Dict[str, Any] = field(default_factory=dict)
    job_info: Dict[str, Any] = field(default_factory=dict)
    questions: List[Dict[str, Any]] = field(default_factory=list)
    evaluation_materials: Dict[str, Any] = field(default_factory=dict)
    interviewer_prompt: str = ""

    @property
    def candidate_name(self) -> str:
        """Get candidate's first name"""
        return self.candidate_info.get("first_name", "Candidate")

    @property
    def job_title(self) -> str:
        """Get job title"""
        return self.job_info.get("title", "Position")

    @property
    def resume_text(self) -> str:
        """Get resume text"""
        return self.evaluation_materials.get("resume_text", "")

    @property
    def job_description(self) -> str:
        """Get job description"""
        return self.evaluation_materials.get("job_description", "")

    def format_context_details(self) -> str:
        """Format the interview context details section"""
        context_text = "## Part 9: Interview Context Details\n"
        context_text += f"- Interview ID: {self.interview_id}\n"
        context_text += f"- Candidate: {self.candidate_name}\n"
        context_text += f"- Job Title: {self.job_title}\n"
        context_text += f"- Questions Count: {len(self.questions)}\n"
        context_text += f"- Resume Text: {self.resume_text[:200] + '...' if self.resume_text and len(self.resume_text) > 200 else self.resume_text}\n"
        context_text += f"- Job Description: {self.job_description[:500] + '...' if self.job_description and len(self.job_description) > 500 else self.job_description}\n"
        return context_text

    def format_questions(self) -> str:
        """Format the interview questions section"""
        questions_text = "\n## Part 10: Interview Questions\n"
        for i, question in enumerate(self.questions, 1):
            questions_text += f"{i}. {question.get('text', 'N/A')} (Type: {question.get('type', 'N/A')})\n"
        return questions_text

    def format_full_context(self) -> str:
        """Format the complete interview context for LLM"""
        # Replace placeholder variables in the interviewer prompt
        prompt = self.interviewer_prompt
        if prompt and self.candidate_name:
            prompt = prompt.replace("[first_name]", self.candidate_name)
            prompt = prompt.replace("[job_title]", self.job_title)

        # Combine all parts
        full_context = prompt + self.format_context_details() + self.format_questions()
        return full_context

    @classmethod
    def from_supabase_record(
        cls, interviewer_record: Dict[str, Any]
    ) -> "InterviewContext":
        """Create InterviewContext from Supabase interviewer record"""
        interview_payload = interviewer_record.get("payload", {})

        return cls(
            interview_id=interviewer_record.get("interview_id"),
            candidate_info=interview_payload.get("candidate", {}),
            job_info=interview_payload.get("job", {}),
            questions=interview_payload.get("questions", []),
            evaluation_materials=interview_payload.get("evaluation_materials", {}),
            interviewer_prompt=interview_payload.get("interviewer_prompt"),
        )
