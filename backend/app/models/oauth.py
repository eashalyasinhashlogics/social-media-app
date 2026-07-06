from sqlalchemy import Column, String, ForeignKey, DateTime
from sqlalchemy.dialects.postgresql import UUID
from sqlalchemy.orm import relationship
import uuid
from datetime import datetime
from app.db.base import Base

class OAuthCredentials(Base):
    """
    OAuth credentials linked to a user
    
    Allows users to have multiple OAuth providers linked
    """
    
    __tablename__ = "oauth_credentials"
    
    id = Column(
        UUID(as_uuid=True),
        primary_key=True,
        default=uuid.uuid4,
        nullable=False
    )
    
    # Foreign key to users
    user_id = Column(
        UUID(as_uuid=True),
        ForeignKey("users.id", ondelete="CASCADE"),
        nullable=False,
        index=True
    )
    
    # OAuth provider ('google', 'github')
    provider = Column(
        String(50),
        nullable=False
    )
    
    # User ID from OAuth provider
    provider_user_id = Column(
        String(255),
        nullable=False
    )
    
    # Timestamp
    created_at = Column(
        DateTime,
        default=datetime.utcnow,
        nullable=False
    )
    
    # Relationship to User
    user = relationship("User", back_populates="oauth_credentials")
    
    def __repr__(self):
        return f"<OAuthCredentials(provider={self.provider}, user_id={self.user_id})>"

