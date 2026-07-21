from pydantic import BaseModel, Field
from typing import Optional, List
import uuid

from app.schemas.post import PostResponse


class ProfileResponse(BaseModel):
    user_id: uuid.UUID
    username: str
    display_name: Optional[str] = None
    bio: Optional[str] = None
    avatar_url: Optional[str] = None
    cover_photo_url: Optional[str] = None
    follower_count: int
    following_count: int
    post_count: int
    posts: List[PostResponse]

    class Config:
        from_attributes = True


class ProfileUpdate(BaseModel):
    """Backs the Edit Profile modal - every field is optional so the
    frontend can send just what changed. `username` is on the User
    table (not UserProfile), so ProfileService.update_profile splits
    the fields across both when it saves."""
    username: Optional[str] = Field(None, min_length=3, max_length=100)
    display_name: Optional[str] = Field(None, max_length=150)
    bio: Optional[str] = Field(None, max_length=500)