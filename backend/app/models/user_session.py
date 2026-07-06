from sqlalchemy import Column, String, DateTime, ForeignKey
from sqlalchemy.dialects.postgresql import UUID
import uuid
from datetime import datetime
from app.db.base import Base

class UserSession(Base):
    __tablename__ = "user_sessions"

    id = Column(UUID(as_uuid=True), primary_key=True, default=uuid.uuid4, nullable=False)
    user_id = Column(UUID(as_uuid=True), ForeignKey("users.id", ondelete="CASCADE"), nullable=False, index=True)
    refresh_token_id = Column(UUID(as_uuid=True), ForeignKey("refresh_tokens.id", ondelete="CASCADE"), nullable=False, unique=True)
    ip_address = Column(String(45), nullable=False)
    user_agent = Column(String, nullable=False)
    last_active_at = Column(DateTime, default=datetime.utcnow, nullable=False)
    created_at = Column(DateTime, default=datetime.utcnow, nullable=False)

    def __repr__(self):
        return f"<UserSession(user_id={self.user_id})>"
