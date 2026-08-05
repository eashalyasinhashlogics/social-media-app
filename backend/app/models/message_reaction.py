from sqlalchemy import Column, DateTime, ForeignKey, String, UniqueConstraint
from sqlalchemy.dialects.postgresql import UUID
from sqlalchemy.orm import relationship, backref
import uuid
from datetime import datetime
from app.db.base import Base


class MessageReaction(Base):
    __tablename__ = "message_reactions"
    __table_args__ = (
        UniqueConstraint("message_id", "user_id", "emoji", name="uq_message_reactions_message_id_user_id_emoji"),
    )

    id = Column(UUID(as_uuid=True), primary_key=True, default=uuid.uuid4, nullable=False)
    message_id = Column(UUID(as_uuid=True), ForeignKey("messages.id", ondelete="CASCADE"), nullable=False, index=True)
    user_id = Column(UUID(as_uuid=True), ForeignKey("users.id", ondelete="CASCADE"), nullable=False, index=True)
    emoji = Column(String(16), nullable=False)
    created_at = Column(DateTime, default=datetime.utcnow, nullable=False)

    # passive_deletes=True tells SQLAlchemy to rely on the DB's ON DELETE
    # CASCADE instead of loading every reaction row and UPDATE-ing its
    # (NOT NULL) message_id to NULL before the parent delete - that UPDATE
    # was violating the NOT NULL constraint and is why deleting a
    # reacted-to message failed.
    message = relationship("Message", backref=backref("reaction_rows", passive_deletes=True))
    user = relationship("User", backref="message_reactions")