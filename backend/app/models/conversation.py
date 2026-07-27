from sqlalchemy import Column, DateTime, ForeignKey
from sqlalchemy import Enum as SAEnum
from sqlalchemy.dialects.postgresql import UUID
import uuid
from datetime import datetime
from app.db.base import Base
from app.db.enums import ConversationType


class Conversation(Base):
    __tablename__ = "conversations"

    id = Column(UUID(as_uuid=True), primary_key=True, default=uuid.uuid4, nullable=False)
    type = Column(SAEnum(ConversationType, name="conversation_type"), default=ConversationType.direct, nullable=False)
    # FK to messages.id is added by the migration *after* the messages
    # table exists (chicken-and-egg), same trick already used for
    # user_profiles.profile_picture_id -> media.
    last_message_id = Column(
    UUID(as_uuid=True),
    ForeignKey("messages.id", name="fk_conversations_last_message_id", use_alter=True),
    nullable=True,
    )
    last_message_at = Column(DateTime, nullable=True)
    created_at = Column(DateTime, default=datetime.utcnow, nullable=False)
    updated_at = Column(DateTime, default=datetime.utcnow, onupdate=datetime.utcnow, nullable=False)

    def __repr__(self):
        return f"<Conversation(id={self.id}, type={self.type})>"