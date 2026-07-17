from fastapi import Depends, HTTPException, status, Request
from fastapi.security import HTTPBearer, HTTPAuthorizationCredentials
from sqlalchemy.orm import Session
from app.db.database import SessionLocal
from app.models.user import User
from app.core.security import decode_token
from app.config import ACCESS_TOKEN_COOKIE_NAME
from jose import JWTError
from typing import Optional

# auto_error=False so requests with no Authorization header don't get
# rejected before we've had a chance to fall back to the cookie.
security = HTTPBearer(auto_error=False)


def get_db() -> Session:
    db = SessionLocal()
    try:
        yield db
    finally:
        db.close()


def _extract_token(
    request: Request,
    credentials: Optional[HTTPAuthorizationCredentials],
) -> Optional[str]:
    # Authorization: Bearer <token> takes priority (used by API clients/tests)
    if credentials and credentials.credentials:
        return credentials.credentials
    # Fall back to the httpOnly cookie set by /auth/login, /auth/refresh, etc.
    return request.cookies.get(ACCESS_TOKEN_COOKIE_NAME)


async def get_current_user(
    request: Request,
    credentials: Optional[HTTPAuthorizationCredentials] = Depends(security),
    db: Session = Depends(get_db)
) -> User:
    token = _extract_token(request, credentials)
    if not token:
        raise HTTPException(status_code=status.HTTP_401_UNAUTHORIZED, detail="Invalid authentication credentials")

    try:
        payload = decode_token(token)
        user_id = payload.get("sub")
        if user_id is None:
            raise HTTPException(status_code=status.HTTP_401_UNAUTHORIZED, detail="Invalid authentication credentials")
    except JWTError:
        raise HTTPException(status_code=status.HTTP_401_UNAUTHORIZED, detail="Invalid authentication credentials")

    user = db.query(User).filter(User.id == user_id).first()
    if user is None:
        raise HTTPException(status_code=status.HTTP_401_UNAUTHORIZED, detail="User not found")
    return user

async def get_current_user_optional(
    request: Request,
    credentials: Optional[HTTPAuthorizationCredentials] = Depends(security),
    db: Session = Depends(get_db),
) -> Optional[User]:
    """Same as get_current_user but returns None instead of raising 401.
    Used on endpoints that work for anonymous visitors but personalize
    the response (e.g. liked_by_me) when a valid session is present."""
    token = _extract_token(request, credentials)
    if not token:
        return None
    try:
        payload = decode_token(token)
        user_id = payload.get("sub")
        if user_id is None:
            return None
    except JWTError:
        return None
    return db.query(User).filter(User.id == user_id).first()

async def get_current_admin(current_user: User = Depends(get_current_user)) -> User:
    from app.db.enums import UserRole
    if current_user.role != UserRole.admin:
        raise HTTPException(status_code=status.HTTP_403_FORBIDDEN, detail="Only admins can access this resource")
    return current_user
