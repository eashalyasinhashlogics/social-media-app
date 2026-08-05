from pydantic import BaseModel, Field
from typing import Optional, List, Annotated
from datetime import datetime
import uuid

from app.db.enums import UserRole
from app.schemas.post import PostResponse


class AdminUserResponse(BaseModel):
    id: uuid.UUID
    email: str
    username: str
    role: str
    status: str
    email_verified: bool
    created_at: datetime
    updated_at: datetime
    deleted_at: Optional[datetime] = None

    class Config:
        from_attributes = True


class AdminUserListResponse(BaseModel):
    total: int
    items: List[AdminUserResponse]


class AdminUserUpdate(BaseModel):
    username: Optional[Annotated[str, Field(min_length=3, max_length=100)]] = None
    role: Optional[UserRole] = None

class AdminPostListResponse(BaseModel):
    total: int
    items: List[PostResponse]


class DailyCount(BaseModel):
    date: str
    count: int


class AdminStatsResponse(BaseModel):
    total_users: int
    total_posts: int
    active_posts: int
    archived_posts: int
    signups_by_day: List[DailyCount]
    likes_by_day: List[DailyCount]
    comments_by_day: List[DailyCount]
