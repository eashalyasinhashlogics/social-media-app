from sqlalchemy import Column, String, Integer, DateTime, ForeignKey
from sqlalchemy import Enum as SAEnum
from sqlalchemy.dialects.postgresql import UUID
from sqlalchemy.orm import relationship, backref
import uuid
from datetime import datetime
from app.db.base import Base
from app.db.enums import MediaType


class Media(Base):
    __tablename__ = "media"

    id = Column(UUID(as_uuid=True), primary_key=True, default=uuid.uuid4, nullable=False)
    uploader_id = Column(UUID(as_uuid=True), ForeignKey("users.id", ondelete="CASCADE"), nullable=False, index=True)
    post_id = Column(UUID(as_uuid=True), ForeignKey("posts.id", ondelete="CASCADE"), nullable=True, index=True)
    # Chat attachments: nullable because the file is uploaded first (so the
    # UI can preview/show progress before the user hits send) and only
    # linked to a message afterwards, once send_message() creates it.
    message_id = Column(UUID(as_uuid=True), ForeignKey("messages.id", ondelete="CASCADE"), nullable=True, index=True)

    url = Column(String(1000), nullable=False)
    public_id = Column(String(255), nullable=True)
    media_type = Column(SAEnum(MediaType, name="media_type"), nullable=False)
    file_size = Column(Integer, nullable=True)
    # Original filename - only meaningful for chat attachments (documents in
    # particular need their real name for the download link/preview label).
    file_name = Column(String(255), nullable=True)

    created_at = Column(DateTime, default=datetime.utcnow, nullable=False)

    uploader = relationship("User", backref="uploaded_media")
    post = relationship("Post", backref="media_items")
    message = relationship("Message", backref=backref("attachments", passive_deletes=True))

    def __repr__(self):
        return f"<Media(id={self.id}, media_type={self.media_type})>"