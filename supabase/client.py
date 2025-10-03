"""
Simple Supabase HTTP client using REST API.
No fancy ORM stuff - just HTTP requests to Supabase REST endpoints.
"""
import httpx
from typing import Optional, List, Dict, Any
from ...config import get_settings


class SupabaseClient:
    """Simple HTTP client for Supabase REST API"""
    
    def __init__(self):
        settings = get_settings()
        self.base_url = f"{settings.SUPABASE_URL}/rest/v1"
        self.headers = {
            "apikey": settings.SUPABASE_ANON_KEY,
            "Authorization": f"Bearer {settings.SUPABASE_ANON_KEY}",
            "Content-Type": "application/json",
            "Prefer": "return=representation"
        }
    
    async def get(self, table: str, filters: Dict[str, str] = None) -> List[Dict[str, Any]]:
        """GET request to Supabase table"""
        url = f"{self.base_url}/{table}"
        params = {}
        
        if filters:
            for key, value in filters.items():
                params[key] = f"eq.{value}"
        
        async with httpx.AsyncClient() as client:
            response = await client.get(url, headers=self.headers, params=params)
            response.raise_for_status()
            return response.json()
    
    async def post(self, table: str, data: Dict[str, Any]) -> Dict[str, Any]:
        """POST request to create record"""
        url = f"{self.base_url}/{table}"
        
        async with httpx.AsyncClient() as client:
            response = await client.post(url, headers=self.headers, json=data)
            response.raise_for_status()
            result = response.json()
            return result[0] if isinstance(result, list) else result
    
    async def patch(self, table: str, filters: Dict[str, str], data: Dict[str, Any]) -> Dict[str, Any]:
        """PATCH request to update record"""
        url = f"{self.base_url}/{table}"
        params = {}
        
        for key, value in filters.items():
            params[key] = f"eq.{value}"
        
        async with httpx.AsyncClient() as client:
            response = await client.patch(url, headers=self.headers, params=params, json=data)
            response.raise_for_status()
            result = response.json()
            
            # PATCH might return empty array on successful update
            if isinstance(result, list):
                return result[0] if result else {"updated": True}
            else:
                return result


# Singleton instance
_client = None

def get_supabase_client() -> SupabaseClient:
    """Get singleton Supabase client"""
    global _client
    if _client is None:
        _client = SupabaseClient()
    return _client