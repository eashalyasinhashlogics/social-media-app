from pydantic import BaseModel
from datetime import datetime
import uuid

from app.schemas.base import UTCTimestampMixin
from app.schemas.user import UserResponse


class FriendRequestCreate(BaseModel):
    to_user_id: uuid.UUID


class FriendRequestResponse(UTCTimestampMixin, BaseModel):
    id: uuid.UUID
    from_user_id: uuid.UUID
    to_user_id: uuid.UUID
    status: str
    created_at: datetime
    updated_at: datetime

    class Config:
        from_attributes = True


class FriendshipResponse(BaseModel):
    friend: UserResponse
    friends_since: datetime

    class Config:
        from_attributes = True