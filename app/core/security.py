from fastapi import Depends, HTTPException, status
from fastapi.security import HTTPBasic, HTTPBasicCredentials
from secrets import compare_digest
from app.core.config import get_settings

settings = get_settings()

security = HTTPBasic()

def verify_admin_key(
    credentials: HTTPBasicCredentials = Depends(security),
) -> str:
    """
    Protects all admin routes.
    Use HTTP Basic auth: username + password
    """
    valid_user = compare_digest(credentials.username, settings.admin_username)
    valid_pass = compare_digest(credentials.password, settings.admin_password)
    if not (valid_user and valid_pass):
        raise HTTPException(
            status_code=status.HTTP_403_FORBIDDEN,
            detail="Invalid or missing admin credentials.",
        )
    return credentials.username
