from pydantic import BaseModel, Field
from datetime import datetime
import uuid


class PostBase(BaseModel):
    content: str = Field(..., min_length=1, max_length=10000)


class PostCreate(PostBase):
    pass


class PostUpdate(BaseModel):
    content: str = Field(..., min_length=1, max_length=10000)


class PostResponse(PostBase):
    id: uuid.UUID
    author_id: uuid.UUID
    status: str
    like_count: int
    comment_count: int
    share_count: int
    created_at: datetime
    updated_at: datetime

    class Config:
        from_attributes = True