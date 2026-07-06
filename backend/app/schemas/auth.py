from pydantic import BaseModel, EmailStr, Field
from typing import Optional

class TokenResponse(BaseModel):
    access_token: str
    refresh_token: str
    token_type: str = "bearer"

class LoginRequest(BaseModel):
    email: EmailStr
    password: str = Field(..., min_length=8)

class RefreshRequest(BaseModel):
    # Optional because the frontend now relies on the httpOnly refresh_token
    # cookie instead of holding the raw token in JS. Server-side / API
    # clients can still pass it explicitly in the body if they want to.
    refresh_token: Optional[str] = None
