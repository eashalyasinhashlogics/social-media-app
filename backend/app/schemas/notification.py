from pydantic import BaseModel
from datetime import datetime
from typing import Optional
import uuid

from app.schemas.base import UTCTimestampMixin


class NotificationActor(BaseModel):
    id: uuid.UUID
    username: str
    avatar_url: Optional[str] = None

    class Config:
        from_attributes = True


class NotificationResponse(UTCTimestampMixin, BaseModel):
    id: uuid.UUID
    type: str
    actor: Optional[NotificationActor] = None
    post_id: Optional[uuid.UUID] = None
    comment_id: Optional[uuid.UUID] = None
    post_preview: Optional[str] = None
    comment_preview: Optional[str] = None
    friend_request_id: Optional[uuid.UUID] = None
    is_read: bool
    created_at: datetime

    class Config:
        from_attributes = True


class UnreadCountResponse(BaseModel):
    unread_count: int


class MarkAllReadResponse(BaseModel):
    marked_read: int