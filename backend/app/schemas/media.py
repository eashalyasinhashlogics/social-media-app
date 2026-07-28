from pydantic import BaseModel
from typing import Optional
from datetime import datetime
import uuid

from app.schemas.base import UTCTimestampMixin


class MediaResponse(UTCTimestampMixin, BaseModel):
    id: uuid.UUID
    uploader_id: uuid.UUID
    post_id: Optional[uuid.UUID] = None
    url: str
    media_type: str
    file_size: Optional[int] = None
    created_at: datetime

    class Config:
        from_attributes = True