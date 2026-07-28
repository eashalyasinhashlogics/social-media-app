from pydantic import BaseModel, Field
from typing import Optional
from datetime import datetime
import uuid

from app.schemas.base import UTCTimestampMixin


class CommentCreate(BaseModel):
    content: str = Field(..., min_length=1, max_length=2000)
    parent_comment_id: Optional[uuid.UUID] = None


class CommentResponse(UTCTimestampMixin, BaseModel):
    id: uuid.UUID
    post_id: uuid.UUID
    user_id: uuid.UUID
    author_username: Optional[str] = None
    parent_comment_id: Optional[uuid.UUID] = None
    content: str
    like_count: int
    created_at: datetime
    updated_at: datetime

    class Config:
        from_attributes = True