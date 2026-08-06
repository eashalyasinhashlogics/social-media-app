from sqlalchemy import Column, String, DateTime, Text, ForeignKey, JSON, Index
from sqlalchemy.dialects.postgresql import UUID, JSONB
from sqlalchemy.orm import relationship
import uuid
from datetime import datetime
from app.db.base import Base


class AuditLog(Base):
    __tablename__ = "audit_logs"

    id = Column(UUID(as_uuid=True), primary_key=True, default=uuid.uuid4, nullable=False)
    admin_id = Column(UUID(as_uuid=True), ForeignKey("users.id", ondelete="CASCADE"), nullable=False, index=True)
    
    action = Column(String(50), nullable=False, index=True)  # e.g., "user_block", "post_delete", "user_edit"
    entity_type = Column(String(20), nullable=False, index=True)  # "user" or "post"
    entity_id = Column(UUID(as_uuid=True), nullable=False, index=True)
    
    previous_data = Column(JSONB, nullable=True)  # Snapshot before change
    new_data = Column(JSONB, nullable=True)       # Snapshot after change
    
    reason = Column(Text, nullable=True)  # Optional reason for the action
    ip_address = Column(String(45), nullable=True)  # IPv4 or IPv6
    
    created_at = Column(DateTime, default=datetime.utcnow, nullable=False, index=True)
    
    admin = relationship("User", backref="audit_logs")
    
    __table_args__ = (
        Index("ix_audit_logs_admin_id_created_at", "admin_id", "created_at"),
        Index("ix_audit_logs_entity_type_entity_id", "entity_type", "entity_id"),
        Index("ix_audit_logs_action_created_at", "action", "created_at"),
    )
    
    def __repr__(self):
        return f"<AuditLog(id={self.id}, admin_id={self.admin_id}, action={self.action}, entity_id={self.entity_id})>"