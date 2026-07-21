from pydantic import BaseModel, Field
from typing import Optional, List
from datetime import datetime
import uuid

from app.schemas.base import UTCTimestampMixin


class PostBase(BaseModel):
    content: str = Field(..., min_length=1, max_length=10000)


class PostCreate(PostBase):
    pass


class PostUpdate(BaseModel):
    content: str = Field(..., min_length=1, max_length=10000)


class ShareCreate(BaseModel):
    caption: Optional[str] = Field(None, max_length=10000)


class MediaItem(BaseModel):
    id: uuid.UUID
    url: str
    media_type: str

    class Config:
        from_attributes = True


class PostResponse(UTCTimestampMixin, BaseModel):
    id: uuid.UUID
    author_id: uuid.UUID
    author_username: Optional[str] = None
    content: str
    status: str
    like_count: int
    comment_count: int
    share_count: int
    created_at: datetime
    updated_at: datetime
    original_post_id: Optional[uuid.UUID] = None
    original_author_username: Optional[str] = None
    original_content: Optional[str] = None
    media: List[MediaItem] = []
    liked_by_me: bool = False

    class Config:
        from_attributes = True


class LikeToggleResponse(BaseModel):
    liked: bool
    like_count: int