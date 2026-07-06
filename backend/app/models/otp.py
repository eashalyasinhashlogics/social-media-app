from sqlalchemy import Column, String, Integer, DateTime, ForeignKey
from sqlalchemy import Enum as SAEnum
from sqlalchemy.dialects.postgresql import UUID
import uuid
from datetime import datetime
from app.db.base import Base
from app.db.enums import OTPType

class OTPVerification(Base):
    __tablename__ = "otp_verifications"

    id = Column(UUID(as_uuid=True), primary_key=True, default=uuid.uuid4, nullable=False)
    user_id = Column(UUID(as_uuid=True), ForeignKey("users.id", ondelete="CASCADE"), nullable=False, index=True)
    otp_type = Column(SAEnum(OTPType, name="otp_type"), nullable=False, index=True)
    otp_hash = Column(String(255), nullable=False)
    expires_at = Column(DateTime, nullable=False)
    used_at = Column(DateTime, nullable=True)
    attempt_count = Column(Integer, default=0, nullable=False)
    max_attempts = Column(Integer, default=5, nullable=False)
    created_at = Column(DateTime, default=datetime.utcnow, nullable=False)

    def is_expired(self) -> bool:
        return datetime.utcnow() > self.expires_at

    def is_max_attempts_exceeded(self) -> bool:
        return self.attempt_count >= self.max_attempts

    def __repr__(self):
        return f"<OTPVerification(user_id={self.user_id}, type={self.otp_type})>"
