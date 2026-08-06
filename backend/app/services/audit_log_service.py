import uuid
import json
from typing import Optional, List, Tuple, Dict, Any
from datetime import datetime
from sqlalchemy.orm import Session
from sqlalchemy import and_, or_, cast, String

from app.models.audit_log import AuditLog
from app.models.user import User
from app.models.post import Post


class AuditLogService:
    
    @staticmethod
    def log_action(
        db: Session,
        admin_id: uuid.UUID,
        action: str,
        entity_type: str,
        entity_id: uuid.UUID,
        previous_data: Optional[Dict[str, Any]] = None,
        new_data: Optional[Dict[str, Any]] = None,
        reason: Optional[str] = None,
        ip_address: Optional[str] = None,
    ) -> AuditLog:
        """
        Create an audit log entry for an admin action.
        
        Args:
            db: Database session
            admin_id: ID of the admin performing the action
            action: Type of action (e.g., "user_block", "post_delete")
            entity_type: Type of entity affected ("user" or "post")
            entity_id: ID of the affected entity
            previous_data: JSON snapshot before change
            new_data: JSON snapshot after change
            reason: Optional reason for the action
            ip_address: IP address from the request
        
        Returns:
            The created AuditLog entry
        """
        audit_log = AuditLog(
            admin_id=admin_id,
            action=action,
            entity_type=entity_type,
            entity_id=entity_id,
            previous_data=previous_data,
            new_data=new_data,
            reason=reason,
            ip_address=ip_address,
        )
        db.add(audit_log)
        db.flush()  # Flush but don't commit yet - caller commits
        return audit_log
    
    @staticmethod
    def list_logs(
        db: Session,
        skip: int = 0,
        limit: int = 20,
        action: Optional[str] = None,
        admin_id: Optional[uuid.UUID] = None,
        entity_type: Optional[str] = None,
        entity_id: Optional[uuid.UUID] = None,
    ) -> Tuple[int, List[AuditLog]]:
        """
        List audit logs with optional filters.
        
        Args:
            db: Database session
            skip: Number of records to skip
            limit: Maximum number of records to return
            action: Filter by action type
            admin_id: Filter by admin ID
            entity_type: Filter by entity type
            entity_id: Filter by specific entity
        
        Returns:
            Tuple of (total_count, list_of_logs)
        """
        query = db.query(AuditLog)
        
        if action is not None:
            query = query.filter(AuditLog.action == action)
        if admin_id is not None:
            query = query.filter(AuditLog.admin_id == admin_id)
        if entity_type is not None:
            query = query.filter(AuditLog.entity_type == entity_type)
        if entity_id is not None:
            query = query.filter(AuditLog.entity_id == entity_id)
        
        total = query.count()
        logs = query.order_by(AuditLog.created_at.desc()).offset(skip).limit(limit).all()
        
        return total, logs
    
    @staticmethod
    def get_log(db: Session, log_id: uuid.UUID) -> Optional[AuditLog]:
        """Get a single audit log by ID."""
        return db.query(AuditLog).filter(AuditLog.id == log_id).first()
    
    @staticmethod
    def capture_user_data(user: User) -> Dict[str, Any]:
        """Capture relevant user data for audit logging."""
        return {
            "id": str(user.id),
            "email": user.email,
            "username": user.username,
            "role": user.role.value,
            "status": user.status.value,
            "email_verified": user.email_verified,
            "created_at": user.created_at.isoformat(),
            "updated_at": user.updated_at.isoformat(),
            "deleted_at": user.deleted_at.isoformat() if user.deleted_at else None,
        }
    
    @staticmethod
    def capture_post_data(post: Post) -> Dict[str, Any]:
        """Capture relevant post data for audit logging."""
        return {
            "id": str(post.id),
            "author_id": str(post.author_id),
            "content": post.content[:500],  # Truncate for size
            "status": post.status.value,
            "like_count": post.like_count,
            "comment_count": post.comment_count,
            "share_count": post.share_count,
            "created_at": post.created_at.isoformat(),
            "updated_at": post.updated_at.isoformat(),
            "deleted_at": post.deleted_at.isoformat() if post.deleted_at else None,
        }