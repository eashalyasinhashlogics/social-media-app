from pydantic import BaseModel, EmailStr, Field, ConfigDict
from typing import Optional
from datetime import datetime
import uuid

class UserBase(BaseModel):
    email: EmailStr
    username: str = Field(..., min_length=3, max_length=100)

class UserCreate(UserBase):
    password: str = Field(..., min_length=8)

class UserUpdate(BaseModel):
    username: Optional[str] = Field(None, min_length=3, max_length=100)

class UserResponse(UserBase):
    id: uuid.UUID
    email_verified: bool
    role: str
    status: str
    created_at: datetime
    updated_at: datetime

    class Config:
        from_attributes = True
