"""
Base Supabase client and operations for the evaluation service.
Provides common database operations with proper error handling.
"""
from typing import Optional, List, Dict, Any, TypeVar, Generic
from supabase import create_client, Client
from abc import ABC, abstractmethod
import logging
from ...config import get_settings

T = TypeVar('T')

class SupabaseBaseRepository(ABC, Generic[T]):
    """
    Abstract base class for Supabase repositories.
    Provides common database operations and error handling.
    """
    
    def __init__(self, table_name: str):
        self.settings = get_settings()
        self.supabase: Client = create_client(
            self.settings.SUPABASE_URL,
            self.settings.SUPABASE_ANON_KEY
        )
        self.table_name = table_name
        self.logger = logging.getLogger(self.__class__.__name__)
    
    @abstractmethod
    def to_dict(self, entity: T) -> Dict[str, Any]:
        """Convert entity to dictionary for storage"""
        pass
    
    @abstractmethod
    def from_dict(self, data: Dict[str, Any]) -> T:
        """Convert dictionary to entity"""
        pass
    
    async def create(self, entity: T) -> T:
        """Create a new record"""
        try:
            data = self.to_dict(entity)
            result = self.supabase.table(self.table_name).insert(data).execute()
            
            if result.data:
                return self.from_dict(result.data[0])
            else:
                raise Exception("Failed to create record - no data returned")
                
        except Exception as e:
            self.logger.error(f"Error creating record in {self.table_name}: {e}")
            raise Exception(f"Database error: {e}")
    
    async def get_by_id(self, entity_id: str) -> Optional[T]:
        """Retrieve a record by ID"""
        try:
            result = self.supabase.table(self.table_name).select("*").eq("id", entity_id).execute()
            
            if result.data:
                return self.from_dict(result.data[0])
            return None
            
        except Exception as e:
            self.logger.error(f"Error retrieving record from {self.table_name}: {e}")
            raise Exception(f"Database error: {e}")
    
    async def update(self, entity: T, entity_id: str) -> T:
        """Update an existing record"""
        try:
            data = self.to_dict(entity)
            result = self.supabase.table(self.table_name).update(data).eq("id", entity_id).execute()
            
            if result.data:
                return self.from_dict(result.data[0])
            else:
                raise Exception("Failed to update record - no data returned")
                
        except Exception as e:
            self.logger.error(f"Error updating record in {self.table_name}: {e}")
            raise Exception(f"Database error: {e}")
    
    async def delete(self, entity_id: str) -> bool:
        """Delete a record"""
        try:
            result = self.supabase.table(self.table_name).delete().eq("id", entity_id).execute()
            return len(result.data) > 0
            
        except Exception as e:
            self.logger.error(f"Error deleting record from {self.table_name}: {e}")
            raise Exception(f"Database error: {e}")
    
    async def list_all(self, limit: int = 100, offset: int = 0) -> List[T]:
        """List records with pagination"""
        try:
            result = self.supabase.table(self.table_name).select("*").range(offset, offset + limit - 1).execute()
            return [self.from_dict(data) for data in result.data]
            
        except Exception as e:
            self.logger.error(f"Error listing records from {self.table_name}: {e}")
            raise Exception(f"Database error: {e}")


class SupabaseClient:
    """
    Centralized Supabase client for dependency injection.
    Manages connection and provides access to specific repositories.
    """
    
    def __init__(self):
        self.settings = get_settings()
        self.client: Client = create_client(
            self.settings.SUPABASE_URL,
            self.settings.SUPABASE_ANON_KEY
        )
        self.logger = logging.getLogger(self.__class__.__name__)
    
    def get_client(self) -> Client:
        """Get the raw Supabase client for custom operations"""
        return self.client
    
    async def health_check(self) -> bool:
        """Check if Supabase connection is healthy"""
        try:
            # Simple query to test connection
            result = self.client.table('interviews').select("count", count="exact").limit(0).execute()
            return True
        except Exception as e:
            self.logger.error(f"Supabase health check failed: {e}")
            return False


# Singleton instance for dependency injection
_supabase_client = None

def get_supabase_client() -> SupabaseClient:
    """Get singleton Supabase client instance"""
    global _supabase_client
    if _supabase_client is None:
        _supabase_client = SupabaseClient()
    return _supabase_client