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