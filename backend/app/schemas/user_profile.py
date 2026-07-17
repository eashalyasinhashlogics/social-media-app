from pydantic import BaseModel, Field
from typing import Optional, List
import uuid

from app.schemas.post import PostResponse


class ProfileResponse(BaseModel):
    user_id: uuid.UUID
    username: str
    bio: Optional[str] = None
    avatar_url: Optional[str] = None
    follower_count: int
    following_count: int
    post_count: int
    posts: List[PostResponse]

    class Config:
        from_attributes = True


class ProfileUpdate(BaseModel):
    bio: Optional[str] = Field(None, max_length=500)