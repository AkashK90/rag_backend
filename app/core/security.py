from fastapi import Security, HTTPException, status
from fastapi.security.api_key import APIKeyHeader
from app.core.config import get_settings

settings = get_settings()

api_key_header = APIKeyHeader(name="X-Admin-API-Key", auto_error=False)

async def verify_admin_key(api_key: str = Security(api_key_header)) -> str:
    """
    Protects all admin routes.
    Pass header:  X-Admin-API-Key: <your key>
    """
    if not api_key or api_key != settings.admin_api_key:
        raise HTTPException(
            status_code=status.HTTP_403_FORBIDDEN,
            detail="Invalid or missing Admin API Key.",
        )
    return api_key
