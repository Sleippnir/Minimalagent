"""
Interview domain entity for managing interview evaluation data.
"""

import json
from typing import Optional, List, Dict, Any
from datetime import datetime
import uuid


class Candidate:
    """Candidate information with simple anonymization to reduce bias"""

    def __init__(self, first_name: str, last_name: str):
        self._original_first_name = first_name
        self._original_last_name = last_name
        # Always anonymize for bias reduction
        self.first_name = "Candidate"
        self.last_name = "A"  # Simple anonymous identifier

    def to_dict(self) -> Dict[str, str]:
        """Always returns anonymized data"""
        return {"first_name": self.first_name, "last_name": self.last_name}

    @classmethod
    def from_dict(cls, data: Dict[str, str]) -> "Candidate":
        # Use provided data or defaults
        first = data.get("first_name", "Unknown")
        last = data.get("last_name", "Unknown")
        return cls(first, last)


class Job:
    """Job information"""

    def __init__(self, title: str, description: str):
        self.title = title
        self.description = description

    def to_dict(self) -> Dict[str, str]:
        return {"title": self.title, "description": self.description}

    @classmethod
    def from_dict(cls, data: Dict[str, str]) -> "Job":
        return cls(title=data.get("title", ""), description=data.get("description", ""))


class Rubric:
    """Evaluation rubric with structured criteria"""

    def __init__(self, name: str, version: int, criteria: Dict[str, str]):
        self.name = name
        self.version = version
        self.criteria = criteria

    def to_dict(self) -> Dict[str, Any]:
        return {"name": self.name, "version": self.version, "criteria": self.criteria}

    @classmethod
    def from_dict(cls, data: Dict[str, Any]) -> "Rubric":
        return cls(
            name=data.get("name", ""),
            version=data.get("version", 1),
            criteria=data.get("criteria", {}),
        )


class TranscriptEntry:
    """Single entry in structured transcript"""

    def __init__(self, speaker: str, text: str):
        self.speaker = speaker  # "interviewer" or "candidate"
        self.text = text

    def to_dict(self) -> Dict[str, str]:
        return {"speaker": self.speaker, "text": self.text}

    @classmethod
    def from_dict(cls, data: Dict[str, str]) -> "TranscriptEntry":
        return cls(speaker=data.get("speaker", ""), text=data.get("text", ""))


class TranscriptData:
    """Transcript data with both full text and structured format"""

    def __init__(
        self, full_text_transcript: str, structured_transcript: List[TranscriptEntry]
    ):
        self.full_text_transcript = full_text_transcript
        self.structured_transcript = structured_transcript

    def to_dict(self) -> Dict[str, Any]:
        return {
            "full_text_transcript": self.full_text_transcript,
            "structured_transcript": [
                entry.to_dict() for entry in self.structured_transcript
            ],
        }

    @classmethod
    def from_dict(cls, data: Dict[str, Any]) -> "TranscriptData":
        structured = [
            TranscriptEntry.from_dict(entry)
            for entry in data.get("structured_transcript", [])
        ]
        return cls(
            full_text_transcript=data.get("full_text_transcript", ""),
            structured_transcript=structured,
        )


class QuestionAnswer:
    """Question and answer pair with ideal answer"""

    def __init__(self, position: int, question_text: str, ideal_answer: str):
        self.position = position
        self.question_text = question_text
        self.ideal_answer = ideal_answer

    def to_dict(self) -> Dict[str, Any]:
        return {
            "position": self.position,
            "question_text": self.question_text,
            "ideal_answer": self.ideal_answer,
        }

    @classmethod
    def from_dict(cls, data: Dict[str, Any]) -> "QuestionAnswer":
        return cls(
            position=data.get("position", 0),
            question_text=data.get("question_text", ""),
            ideal_answer=data.get("ideal_answer", ""),
        )


class EvaluationMaterials:
    """Materials used for evaluation"""

    def __init__(self, evaluator_prompt: str, rubric: Rubric):
        self.evaluator_prompt = evaluator_prompt
        self.rubric = rubric

    def to_dict(self) -> Dict[str, Any]:
        return {
            "evaluator_prompt": self.evaluator_prompt,
            "rubric": self.rubric.to_dict(),
        }

    @classmethod
    def from_dict(cls, data: Dict[str, Any]) -> "EvaluationMaterials":
        return cls(
            evaluator_prompt=data.get("evaluator_prompt", ""),
            rubric=Rubric.from_dict(data.get("rubric", {})),
        )


class Interview:
    """
    A domain entity to store and manage interview data for LLM evaluation.

    This class follows the structured format required by the LLM evaluation system,
    containing candidate information, job details, evaluation materials, transcript data,
    and question-answer pairs with ideal answers.
    """

    def __init__(
        self,
        interview_id: Optional[str] = None,
        candidate: Optional[Candidate] = None,
        job: Optional[Job] = None,
        evaluation_materials: Optional[EvaluationMaterials] = None,
        transcript_data: Optional[TranscriptData] = None,
        questions_and_answers: Optional[List[QuestionAnswer]] = None,
    ):
        """
        Initializes the Interview object with structured data.

        Args:
            interview_id: Unique identifier for the interview
            candidate: Candidate information (first_name, last_name)
            job: Job information (title, description)
            evaluation_materials: Evaluation prompt and rubric
            transcript_data: Full and structured transcript
            questions_and_answers: List of questions with ideal answers
        """
        self.interview_id = interview_id or str(uuid.uuid4())
        self.candidate = candidate or self._default_candidate()
        self.job = job or self._default_job()
        self.evaluation_materials = (
            evaluation_materials or self._default_evaluation_materials()
        )
        self.transcript_data = transcript_data or self._default_transcript_data()
        self.questions_and_answers = (
            questions_and_answers or self._default_questions_and_answers()
        )

        # Evaluation results - populated by LLM evaluation
        self.evaluation_1: Optional[Dict[str, Any]] = None  # OpenAI evaluation result
        self.evaluation_2: Optional[Dict[str, Any]] = (
            None  # Google Gemini evaluation result
        )
        self.evaluation_3: Optional[Dict[str, Any]] = None  # DeepSeek evaluation result

        # Metadata
        self.created_at = datetime.now()
        self.updated_at = datetime.now()

    def _default_candidate(self) -> Candidate:
        """Returns a default candidate for testing"""
        return Candidate("John", "Smith")

    def _default_job(self) -> Job:
        """Returns a default job description"""
        return Job(
            title="Senior Software Engineer",
            description=(
                "We are looking for a Senior Software Engineer with 5+ years of experience "
                "in Python development. The ideal candidate will have a strong background "
                "in building scalable web applications, working with cloud services (AWS/GCP), "
                "and experience with containerization technologies like Docker. "
                "Responsibilities include designing and implementing new features, mentoring "
                "junior engineers, and contributing to a collaborative team environment."
            ),
        )

    def _default_evaluation_materials(self) -> EvaluationMaterials:
        """Returns default evaluation materials"""
        rubric = Rubric(
            name="Technical Interview Rubric",
            version=1,
            criteria={
                "technical_proficiency": "Understanding of core concepts, problem-solving approach, code quality and efficiency (1-10)",
                "communication_skills": "Clarity of explanations, ability to articulate thought process, professionalism (1-10)",
                "cultural_fit": "Alignment with company values, enthusiasm for the role, collaboration mindset (1-10)",
            },
        )

        return EvaluationMaterials(
            evaluator_prompt=(
                "You are an expert technical recruiter and hiring manager. "
                "Your task is to evaluate the provided interview transcript based on the "
                "job description and the rubric. Provide a detailed, constructive, and "
                "unbiased evaluation. Assess the candidate's technical skills, "
                "communication abilities, and overall fit for the role. "
                "Provide scores for each category in the rubric and a final summary."
            ),
            rubric=rubric,
        )

    def _default_transcript_data(self) -> TranscriptData:
        """Returns default transcript data"""
        structured_entries = [
            TranscriptEntry(
                "interviewer",
                "Hi, thanks for joining. Can you start by telling me about a challenging project you've worked on?",
            ),
            TranscriptEntry(
                "candidate",
                "Sure. In my last role, I was tasked with refactoring a monolithic legacy service into a microservices architecture. The main challenge was ensuring zero downtime during the migration. We used a strangler fig pattern to gradually move traffic to the new services. It was complex but ultimately successful.",
            ),
            TranscriptEntry(
                "interviewer",
                "That sounds interesting. How would you handle a disagreement with a colleague about a technical implementation?",
            ),
            TranscriptEntry(
                "candidate",
                "I believe in open communication. I'd first listen to their perspective to fully understand their reasoning. Then, I would present my viewpoint with supporting data or examples. The goal is to find the best solution for the project, not to 'win' an argument. If we still can't agree, we could involve a third party, like a tech lead, for a final decision.",
            ),
        ]

        full_text = "\n\n".join(
            [
                f"**{entry.speaker.title()}:** '{entry.text}'"
                for entry in structured_entries
            ]
        )

        return TranscriptData(
            full_text_transcript=full_text, structured_transcript=structured_entries
        )

    def _default_questions_and_answers(self) -> List[QuestionAnswer]:
        """Returns default questions and answers"""
        return [
            QuestionAnswer(
                position=1,
                question_text="Can you tell me about a challenging project you've worked on?",
                ideal_answer="Should demonstrate problem-solving skills, technical depth, and ability to handle complexity. Look for specific examples, challenges faced, solutions implemented, and outcomes achieved.",
            ),
            QuestionAnswer(
                position=2,
                question_text="How would you handle a disagreement with a colleague about a technical implementation?",
                ideal_answer="Should show emotional intelligence, communication skills, and collaborative approach. Look for listening skills, data-driven decision making, and escalation strategies.",
            ),
        ]

    def to_llm_evaluation_format(self) -> Dict[str, Any]:
        """
        Convert Interview to the exact format expected by the LLM evaluation prompt.
        This matches the input structure defined in the evaluation prompt.
        """
        return {
            "interview_id": self.interview_id,
            "candidate": self.candidate.to_dict(),
            "job": self.job.to_dict(),
            "evaluation_materials": self.evaluation_materials.to_dict(),
            "transcript_data": self.transcript_data.to_dict(),
            "questions_and_answers": [
                qa.to_dict() for qa in self.questions_and_answers
            ],
        }

    def to_dict(self) -> Dict[str, Any]:
        """Serializes the complete object to a dictionary for storage."""
        result = self.to_llm_evaluation_format()

        # Add evaluation results and metadata
        result.update(
            {
                "evaluation_1": self.evaluation_1,
                "evaluation_2": self.evaluation_2,
                "evaluation_3": self.evaluation_3,
                "created_at": self.created_at.isoformat() if self.created_at else None,
                "updated_at": self.updated_at.isoformat() if self.updated_at else None,
            }
        )

        return result

    @classmethod
    def from_dict(cls, data: Dict[str, Any]) -> "Interview":
        """Creates an Interview object from a dictionary."""
        # Parse structured components
        candidate = Candidate.from_dict(data.get("candidate", {}))
        job = Job.from_dict(data.get("job", {}))
        evaluation_materials = EvaluationMaterials.from_dict(
            data.get("evaluation_materials", {})
        )
        transcript_data = TranscriptData.from_dict(data.get("transcript_data", {}))

        questions_and_answers = [
            QuestionAnswer.from_dict(qa_data)
            for qa_data in data.get("questions_and_answers", [])
        ]

        # Create interview instance
        interview = cls(
            interview_id=data.get("interview_id"),
            candidate=candidate,
            job=job,
            evaluation_materials=evaluation_materials,
            transcript_data=transcript_data,
            questions_and_answers=questions_and_answers,
        )

        # Set evaluation results
        interview.evaluation_1 = data.get("evaluation_1")
        interview.evaluation_2 = data.get("evaluation_2")
        interview.evaluation_3 = data.get("evaluation_3")

        # Set metadata
        if data.get("created_at"):
            interview.created_at = datetime.fromisoformat(data["created_at"])
        if data.get("updated_at"):
            interview.updated_at = datetime.fromisoformat(data["updated_at"])

        return interview

    @classmethod
    def from_json(cls, json_data: Dict[str, Any]) -> "Interview":
        """
        Create an Interview object from the JSON payload structure used in Supabase.

        Expected format from interviewer_queue table:
        {
            "interview_id": "uuid",
            "candidate_name": "Full Name",
            "job_title": "Position Title",
            "job_description": "Job description text",
            "questions": [...],
            "resume_text": "Resume content",
            "interviewer_prompt": "System prompt"
        }
        """
        # Extract interview_id
        interview_id = json_data.get("interview_id")

        # Parse candidate name
        candidate_name = json_data.get("candidate_name", "Unknown Candidate")
        # Split name into first and last (default to "Unknown" if not splittable)
        name_parts = candidate_name.split(" ", 1)
        first_name = name_parts[0] if name_parts else "Unknown"
        last_name = name_parts[1] if len(name_parts) > 1 else "Candidate"

        candidate = Candidate(first_name, last_name)

        # Create job from job_title and job_description
        job = Job(
            title=json_data.get("job_title", "Position"),
            description=json_data.get("job_description", ""),
        )

        # Create evaluation materials
        rubric = Rubric(
            name="Interview Evaluation Rubric",
            version=1,
            criteria={
                "technical_skills": "Technical competency assessment",
                "communication": "Communication and collaboration skills",
                "problem_solving": "Problem-solving approach and methodology",
                "cultural_fit": "Alignment with company values and culture",
            },
        )

        evaluation_materials = EvaluationMaterials(
            evaluator_prompt=json_data.get(
                "interviewer_prompt", "Evaluate this candidate based on the interview."
            ),
            rubric=rubric,
        )

        # Create basic transcript data (empty for now, will be populated later)
        transcript_data = TranscriptData(
            full_text_transcript="", structured_transcript=[]
        )

        # Convert questions to QuestionAnswer objects
        questions_data = json_data.get("questions", [])
        questions_and_answers = []

        if questions_data:  # Only process if questions_data is not None/empty
            for i, question in enumerate(questions_data, 1):
                if isinstance(question, str):
                    # Simple string question
                    qa = QuestionAnswer(
                        i, question, "Evaluate based on candidate response"
                    )
                elif isinstance(question, dict):
                    # Structured question object
                    question_text = question.get(
                        "question", question.get("text", f"Question {i}")
                    )
                    ideal_answer = question.get(
                        "ideal_answer",
                        question.get(
                            "expected", "Evaluate based on candidate response"
                        ),
                    )
                    qa = QuestionAnswer(i, question_text, ideal_answer)
                else:
                    # Fallback
                    qa = QuestionAnswer(
                        i, f"Question {i}", "Evaluate based on candidate response"
                    )

                questions_and_answers.append(qa)
        else:
            # No questions provided, create a default one
            questions_and_answers = [
                QuestionAnswer(
                    1,
                    "General interview evaluation",
                    "Evaluate the candidate's overall performance based on the interview transcript",
                )
            ]

        # Create the interview
        interview = cls(
            interview_id=interview_id,
            candidate=candidate,
            job=job,
            evaluation_materials=evaluation_materials,
            transcript_data=transcript_data,
            questions_and_answers=questions_and_answers,
        )

        return interview

    @classmethod
    def from_legacy_format(cls, legacy_data: Dict[str, Any]) -> "Interview":
        """
        Convert from the old Interview format to the new structured format.
        This helps with backward compatibility.
        """
        # Extract basic info
        interview_id = legacy_data.get("interview_id")

        # Create candidate from legacy data (may be empty)
        candidate = Candidate("Unknown", "Candidate")

        # Create job from legacy jd field
        job = Job(title="Position", description=legacy_data.get("jd", ""))

        # Create evaluation materials from legacy fields
        rubric = Rubric(
            name="Legacy Rubric",
            version=1,
            criteria={"general_evaluation": legacy_data.get("rubric", "")},
        )

        evaluation_materials = EvaluationMaterials(
            evaluator_prompt=legacy_data.get("system_prompt", ""), rubric=rubric
        )

        # Create transcript data from legacy full_transcript
        full_text = legacy_data.get("full_transcript", "")

        # Try to parse structured transcript from full text (basic parsing)
        structured_entries = []
        if full_text:
            # Simple parsing - split by common patterns
            lines = full_text.split("\n\n")
            for line in lines:
                if line.strip():
                    if line.startswith("**Interviewer:**") or line.lower().startswith(
                        "interviewer:"
                    ):
                        text = (
                            line.replace("**Interviewer:**", "")
                            .replace("interviewer:", "")
                            .strip(" '\"")
                        )
                        structured_entries.append(TranscriptEntry("interviewer", text))
                    elif line.startswith("**Candidate:**") or line.lower().startswith(
                        "candidate:"
                    ):
                        text = (
                            line.replace("**Candidate:**", "")
                            .replace("candidate:", "")
                            .strip(" '\"")
                        )
                        structured_entries.append(TranscriptEntry("candidate", text))

        transcript_data = TranscriptData(
            full_text_transcript=full_text, structured_transcript=structured_entries
        )

        # Create basic questions and answers
        questions_and_answers = [
            QuestionAnswer(
                1, "General interview questions", "Evaluate based on transcript content"
            )
        ]

        # Create new interview
        interview = cls(
            interview_id=interview_id,
            candidate=candidate,
            job=job,
            evaluation_materials=evaluation_materials,
            transcript_data=transcript_data,
            questions_and_answers=questions_and_answers,
        )

        # Set legacy evaluation results
        interview.evaluation_1 = legacy_data.get("evaluation_1")
        interview.evaluation_2 = legacy_data.get("evaluation_2")
        interview.evaluation_3 = legacy_data.get("evaluation_3")

        return interview

    def update_timestamp(self):
        """Update the updated_at timestamp"""
        self.updated_at = datetime.now()

    def add_question_answer(self, question_text: str, ideal_answer: str):
        """Add a new question-answer pair"""
        position = len(self.questions_and_answers) + 1
        qa = QuestionAnswer(position, question_text, ideal_answer)
        self.questions_and_answers.append(qa)
        self.update_timestamp()

    def add_transcript_entry(self, speaker: str, text: str):
        """Add a new entry to the structured transcript"""
        entry = TranscriptEntry(speaker, text)
        self.transcript_data.structured_transcript.append(entry)

        # Update full text transcript
        new_entry_text = f"**{speaker.title()}:** '{text}'"
        if self.transcript_data.full_text_transcript:
            self.transcript_data.full_text_transcript += f"\n\n{new_entry_text}"
        else:
            self.transcript_data.full_text_transcript = new_entry_text

        self.update_timestamp()

    def get_evaluation_status(self) -> Dict[str, Any]:
        """Get the status of all evaluations"""
        return {
            "total_evaluations": 3,
            "completed_evaluations": sum(
                [
                    1
                    for eval in [
                        self.evaluation_1,
                        self.evaluation_2,
                        self.evaluation_3,
                    ]
                    if eval is not None
                ]
            ),
            "evaluations": {
                "openai_gpt5": {"completed": self.evaluation_1 is not None},
                "google_gemini": {"completed": self.evaluation_2 is not None},
                "deepseek": {"completed": self.evaluation_3 is not None},
            },
        }

    def __repr__(self):
        """Provides a developer-friendly string representation of the object."""
        return (
            f"Interview(id={self.interview_id}, "
            f"candidate={self.candidate.first_name} {self.candidate.last_name}, "
            f"job={self.job.title}, "
            f"questions={len(self.questions_and_answers)}, "
            f"evaluations_completed={self.get_evaluation_status()['completed_evaluations']}/3)"
        )


def create_interview_from_legacy(
    interview_id: str = None,
    system_prompt: str = None,
    rubric: str = None,
    jd: str = None,
    full_transcript: str = None,
) -> Interview:
    """Create a new Interview using the old parameter format for backward compatibility."""
    legacy_data = {
        "interview_id": interview_id,
        "system_prompt": system_prompt,
        "rubric": rubric,
        "jd": jd,
        "full_transcript": full_transcript,
    }
    return Interview.from_legacy_format(legacy_data)


# Example of how to use the new class
if __name__ == "__main__":
    # Create a structured interview
    candidate = Candidate("Jane", "Doe")
    job = Job("Senior Python Developer", "Python development with 5+ years experience")

    rubric = Rubric(
        name="Technical Assessment",
        version=1,
        criteria={
            "python_skills": "Python programming proficiency (1-10)",
            "system_design": "System design understanding (1-10)",
            "communication": "Communication clarity (1-10)",
        },
    )

    evaluation_materials = EvaluationMaterials(
        evaluator_prompt="Evaluate this candidate's technical skills", rubric=rubric
    )

    transcript_entries = [
        TranscriptEntry("interviewer", "Tell me about your Python experience"),
        TranscriptEntry("candidate", "I have 6 years of Python development experience"),
    ]

    transcript_data = TranscriptData(
        full_text_transcript="Interviewer: Tell me about your Python experience\nCandidate: I have 6 years of Python development experience",
        structured_transcript=transcript_entries,
    )

    questions = [
        QuestionAnswer(
            1,
            "Tell me about your Python experience",
            "Should demonstrate depth of Python knowledge",
        )
    ]

    interview = Interview(
        interview_id="test-123",
        candidate=candidate,
        job=job,
        evaluation_materials=evaluation_materials,
        transcript_data=transcript_data,
        questions_and_answers=questions,
    )

    print("--- New Structured Interview ---")
    print(interview)

    # Convert to LLM evaluation format
    llm_format = interview.to_llm_evaluation_format()
    print("\n--- LLM Evaluation Format ---")
    print(json.dumps(llm_format, indent=2))

    # Test backward compatibility
    legacy_interview = create_interview_from_legacy(
        interview_id="legacy-456",
        system_prompt="You are an evaluator",
        rubric="Rate 1-10",
        jd="Software Engineer",
        full_transcript="**Interviewer:** Hello\n\n**Candidate:** Hi there",
    )

    print("\n--- Legacy Compatibility ---")
    print(legacy_interview)
