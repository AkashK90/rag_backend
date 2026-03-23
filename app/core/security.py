from fastapi import Depends, HTTPException, status, Request
from fastapi.security import HTTPBasic, HTTPBasicCredentials
from secrets import compare_digest
from app.core.config import get_settings

settings = get_settings()

security = HTTPBasic(auto_error=False)

def verify_admin_key(
    request: Request,
    credentials: HTTPBasicCredentials | None = Depends(security),
) -> str:
    """
    Protects all admin routes.
    Use HTTP Basic auth: username + password
    """
    # Allow CORS preflight without auth
    if request.method == "OPTIONS":
        return "preflight"

    if credentials is None:
        raise HTTPException(
            status_code=status.HTTP_403_FORBIDDEN,
            detail="Invalid or missing admin credentials.",
        )

    valid_user = compare_digest(credentials.username, settings.admin_username)
    valid_pass = compare_digest(credentials.password, settings.admin_password)
    if not (valid_user and valid_pass):
        raise HTTPException(
            status_code=status.HTTP_403_FORBIDDEN,
            detail="Invalid or missing admin credentials.",
        )
    return credentials.username
