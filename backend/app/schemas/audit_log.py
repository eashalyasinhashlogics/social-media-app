from pydantic import BaseModel, Field
from typing import Optional, List, Any, Dict
from datetime import datetime
import uuid


class AuditLogResponse(BaseModel):
    id: uuid.UUID
    admin_id: uuid.UUID
    action: str
    entity_type: str
    entity_id: uuid.UUID
    previous_data: Optional[Dict[str, Any]] = None
    new_data: Optional[Dict[str, Any]] = None
    reason: Optional[str] = None
    ip_address: Optional[str] = None
    created_at: datetime
    
    class Config:
        from_attributes = True


class AuditLogListResponse(BaseModel):
    total: int
    items: List[AuditLogResponse]


class AuditLogFilterRequest(BaseModel):
    action: Optional[str] = None
    admin_id: Optional[uuid.UUID] = None
    entity_type: Optional[str] = None
    entity_id: Optional[uuid.UUID] = None
    search: Optional[str] = None  # General search across data