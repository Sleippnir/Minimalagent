"""
Evaluator repository implementation using Supabase.
Handles CRUD operations for evaluator payloads and results.
"""
from typing import Optional, List, Dict, Any
from datetime import datetime
from .base_repository import SupabaseBaseRepository


class EvaluatorPayload:
    """Entity representing an evaluator payload"""
    
    def __init__(
        self,
        evaluator_id: str,
        name: str,
        version: str,
        prompt_template: str,
        configuration: Dict[str, Any],
        created_at: Optional[datetime] = None
    ):
        self.evaluator_id = evaluator_id
        self.name = name
        self.version = version
        self.prompt_template = prompt_template
        self.configuration = configuration
        self.created_at = created_at or datetime.now()
    
    def to_dict(self) -> Dict[str, Any]:
        return {
            "evaluator_id": self.evaluator_id,
            "name": self.name,
            "version": self.version,
            "prompt_template": self.prompt_template,
            "configuration": self.configuration,
            "created_at": self.created_at.isoformat() if self.created_at else None
        }
    
    @classmethod
    def from_dict(cls, data: Dict[str, Any]) -> 'EvaluatorPayload':
        created_at = None
        if data.get("created_at"):
            created_at = datetime.fromisoformat(data["created_at"])
        
        return cls(
            evaluator_id=data.get("evaluator_id", ""),
            name=data.get("name", ""),
            version=data.get("version", ""),
            prompt_template=data.get("prompt_template", ""),
            configuration=data.get("configuration", {}),
            created_at=created_at
        )


class EvaluatorResult:
    """Entity representing an evaluation result"""
    
    def __init__(
        self,
        result_id: str,
        interview_id: str,
        evaluator_id: str,
        provider: str,
        result_data: Dict[str, Any],
        status: str = "completed",
        error_message: Optional[str] = None,
        created_at: Optional[datetime] = None
    ):
        self.result_id = result_id
        self.interview_id = interview_id
        self.evaluator_id = evaluator_id
        self.provider = provider
        self.result_data = result_data
        self.status = status
        self.error_message = error_message
        self.created_at = created_at or datetime.now()
    
    def to_dict(self) -> Dict[str, Any]:
        return {
            "result_id": self.result_id,
            "interview_id": self.interview_id,
            "evaluator_id": self.evaluator_id,
            "provider": self.provider,
            "result_data": self.result_data,
            "status": self.status,
            "error_message": self.error_message,
            "created_at": self.created_at.isoformat() if self.created_at else None
        }
    
    @classmethod
    def from_dict(cls, data: Dict[str, Any]) -> 'EvaluatorResult':
        created_at = None
        if data.get("created_at"):
            created_at = datetime.fromisoformat(data["created_at"])
        
        return cls(
            result_id=data.get("result_id", ""),
            interview_id=data.get("interview_id", ""),
            evaluator_id=data.get("evaluator_id", ""),
            provider=data.get("provider", ""),
            result_data=data.get("result_data", {}),
            status=data.get("status", "completed"),
            error_message=data.get("error_message"),
            created_at=created_at
        )


class Evaluation:
    """Entity representing an LLM evaluation result"""
    
    def __init__(
        self,
        evaluation_id: Optional[str] = None,
        interview_id: str = "",
        evaluator_llm_model: str = "",
        score: Optional[float] = None,
        reasoning: str = "",
        raw_llm_response: Optional[Dict[str, Any]] = None,
        created_at: Optional[datetime] = None
    ):
        self.evaluation_id = evaluation_id
        self.interview_id = interview_id
        self.evaluator_llm_model = evaluator_llm_model
        self.score = score
        self.reasoning = reasoning
        self.raw_llm_response = raw_llm_response or {}
        self.created_at = created_at or datetime.now()
    
    def to_dict(self) -> Dict[str, Any]:
        data = {
            "interview_id": self.interview_id,
            "evaluator_llm_model": self.evaluator_llm_model,
            "reasoning": self.reasoning,
            "raw_llm_response": self.raw_llm_response,
            "created_at": self.created_at.isoformat() if self.created_at else None
        }
        
        # Only include score if it's not None
        if self.score is not None:
            data["score"] = self.score
            
        # Only include evaluation_id if it's not None (for updates)
        if self.evaluation_id is not None:
            data["evaluation_id"] = self.evaluation_id
            
        return data
    
    @classmethod
    def from_dict(cls, data: Dict[str, Any]) -> 'Evaluation':
        created_at = None
        if data.get("created_at"):
            created_at = datetime.fromisoformat(data["created_at"])
        
        return cls(
            evaluation_id=data.get("evaluation_id"),
            interview_id=data.get("interview_id", ""),
            evaluator_llm_model=data.get("evaluator_llm_model", ""),
            score=data.get("score"),
            reasoning=data.get("reasoning", ""),
            raw_llm_response=data.get("raw_llm_response", {}),
            created_at=created_at
        )


class EvaluatorPayloadRepository(SupabaseBaseRepository[EvaluatorPayload]):
    """Repository for managing evaluator payloads in Supabase"""
    
    def __init__(self):
        super().__init__(table_name="evaluator_payloads")
    
    def to_dict(self, payload: EvaluatorPayload) -> Dict[str, Any]:
        return payload.to_dict()
    
    def from_dict(self, data: Dict[str, Any]) -> EvaluatorPayload:
        return EvaluatorPayload.from_dict(data)
    
    async def get_by_evaluator_id(self, evaluator_id: str) -> Optional[EvaluatorPayload]:
        """Get evaluator payload by evaluator_id"""
        try:
            result = self.supabase.table(self.table_name).select("*").eq("evaluator_id", evaluator_id).execute()
            
            if result.data:
                return self.from_dict(result.data[0])
            return None
            
        except Exception as e:
            self.logger.error(f"Error retrieving evaluator payload: {e}")
            raise Exception(f"Database error: {e}")
    
    async def get_latest_version(self, name: str) -> Optional[EvaluatorPayload]:
        """Get the latest version of an evaluator by name"""
        try:
            result = self.supabase.table(self.table_name).select("*").eq("name", name).order("version", desc=True).limit(1).execute()
            
            if result.data:
                return self.from_dict(result.data[0])
            return None
            
        except Exception as e:
            self.logger.error(f"Error retrieving latest evaluator version: {e}")
            raise Exception(f"Database error: {e}")


class EvaluatorResultRepository(SupabaseBaseRepository[EvaluatorResult]):
    """Repository for managing evaluation results in Supabase"""
    
    def __init__(self):
        super().__init__(table_name="evaluator_results")
    
    def to_dict(self, result: EvaluatorResult) -> Dict[str, Any]:
        return result.to_dict()
    
    def from_dict(self, data: Dict[str, Any]) -> EvaluatorResult:
        return EvaluatorResult.from_dict(data)
    
    async def get_by_interview_id(self, interview_id: str) -> List[EvaluatorResult]:
        """Get all evaluation results for an interview"""
        try:
            result = self.supabase.table(self.table_name).select("*").eq("interview_id", interview_id).execute()
            
            return [self.from_dict(data) for data in result.data]
            
        except Exception as e:
            self.logger.error(f"Error retrieving results for interview: {e}")
            raise Exception(f"Database error: {e}")
    
    async def get_by_provider(self, interview_id: str, provider: str) -> Optional[EvaluatorResult]:
        """Get evaluation result for specific interview and provider"""
        try:
            result = self.supabase.table(self.table_name).select("*").eq("interview_id", interview_id).eq("provider", provider).limit(1).execute()
            
            if result.data:
                return self.from_dict(result.data[0])
            return None
            
        except Exception as e:
            self.logger.error(f"Error retrieving result for provider: {e}")
            raise Exception(f"Database error: {e}")
    
    async def save_evaluation(self, evaluation_data: Dict[str, Any]) -> bool:
        """Save evaluation results to the database"""
        try:
            # Create an EvaluatorResult object from the evaluation data
            result = EvaluatorResult(
                result_id=f"{evaluation_data['interview_id']}_combined_{datetime.now().isoformat()}",
                interview_id=evaluation_data['interview_id'],
                evaluator_id="background_evaluator_v1",  # Default evaluator ID
                provider="combined",  # This combines all LLM evaluations
                result_data=evaluation_data['evaluation_results'],
                status=evaluation_data.get('status', 'completed'),
                error_message=evaluation_data.get('error_message'),
                created_at=datetime.now()
            )
            
            # Save to database
            await self.create(result)
            return True
            
        except Exception as e:
            self.logger.error(f"Error saving evaluation: {e}")
            return False


# Service class that combines both repositories
class EvaluatorService:
    """Service for managing evaluator operations"""
    
    def __init__(self):
        self.payload_repo = EvaluatorPayloadRepository()
        self.result_repo = EvaluatorResultRepository()
    
    async def get_evaluator_payload(self, evaluator_id: str) -> Optional[EvaluatorPayload]:
        """Retrieve evaluator payload"""
        return await self.payload_repo.get_by_evaluator_id(evaluator_id)
    
    async def save_evaluation_result(self, result: EvaluatorResult) -> EvaluatorResult:
        """Save evaluation result"""
        return await self.result_repo.create(result)
    
    async def get_interview_results(self, interview_id: str) -> List[EvaluatorResult]:
        """Get all results for an interview"""
        return await self.result_repo.get_by_interview_id(interview_id)
    
    async def get_provider_result(self, interview_id: str, provider: str) -> Optional[EvaluatorResult]:
        """Get result for specific provider"""
        return await self.result_repo.get_by_provider(interview_id, provider)


class EvaluationRepository(SupabaseBaseRepository[Evaluation]):
    """Repository for managing LLM evaluation results in Supabase"""
    
    def __init__(self):
        super().__init__(table_name="evaluations")
    
    def to_dict(self, evaluation: Evaluation) -> Dict[str, Any]:
        return evaluation.to_dict()
    
    def from_dict(self, data: Dict[str, Any]) -> Evaluation:
        return Evaluation.from_dict(data)
    
    async def get_by_interview_id(self, interview_id: str) -> List[Evaluation]:
        """Get all evaluations for an interview"""
        try:
            result = self.supabase.table(self.table_name).select("*").eq("interview_id", interview_id).execute()
            
            return [self.from_dict(data) for data in result.data]
            
        except Exception as e:
            self.logger.error(f"Error retrieving evaluations for interview: {e}")
            raise Exception(f"Database error: {e}")
    
    async def get_by_model(self, interview_id: str, model: str) -> Optional[Evaluation]:
        """Get evaluation for specific interview and LLM model"""
        try:
            result = self.supabase.table(self.table_name).select("*").eq("interview_id", interview_id).eq("evaluator_llm_model", model).limit(1).execute()
            
            if result.data:
                return self.from_dict(result.data[0])
            return None
            
        except Exception as e:
            self.logger.error(f"Error retrieving evaluation for model: {e}")
            raise Exception(f"Database error: {e}")