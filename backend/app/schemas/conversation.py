from pydantic import BaseModel, Field, field_serializer
from typing import Optional, List
from datetime import datetime, timezone
import uuid

from app.schemas.base import UTCTimestampMixin


class ConversationCreate(BaseModel):
    user_id: uuid.UUID  # the other participant - only direct (1:1) conversations for now


class MessageCreate(BaseModel):
    content: str = Field(..., min_length=1, max_length=5000)


class MessageResponse(UTCTimestampMixin, BaseModel):
    id: uuid.UUID
    conversation_id: uuid.UUID
    sender_id: uuid.UUID
    content: str
    created_at: datetime

    class Config:
        from_attributes = True


class ConversationResponse(UTCTimestampMixin, BaseModel):
    id: uuid.UUID
    type: str
    participant_ids: List[uuid.UUID]
    last_message: Optional[MessageResponse] = None
    last_message_at: Optional[datetime] = None
    unread_count: int = 0
    created_at: datetime
    updated_at: datetime

    class Config:
        from_attributes = True

    @field_serializer("last_message_at", when_used="json")
    def _serialize_last_message_at(self, value: Optional[datetime]) -> Optional[str]:
        if value is None:
            return None
        if value.tzinfo is None:
            value = value.replace(tzinfo=timezone.utc)
        return value.isoformat()

class MarkReadResponse(BaseModel):
    marked_read: int


class UnreadCountResponse(BaseModel):
    conversation_id: uuid.UUID
    unread_count: int
