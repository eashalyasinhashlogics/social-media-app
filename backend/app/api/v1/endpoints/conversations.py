from fastapi import APIRouter, Depends, status
from sqlalchemy.orm import Session
from typing import List
import uuid

from app.core.dependencies import get_db, get_current_user
from app.models.user import User
from app.schemas.conversation import ConversationCreate, ConversationResponse, MessageCreate, MessageResponse
from app.services.conversation_service import ConversationService

router = APIRouter(prefix="/conversations", tags=["chat"])


@router.post("", response_model=ConversationResponse, status_code=status.HTTP_201_CREATED)
def start_conversation(
    payload: ConversationCreate,
    current_user: User = Depends(get_current_user),
    db: Session = Depends(get_db),
):
    conversation = ConversationService.get_or_create_direct_conversation(db, current_user.id, payload.user_id)
    return ConversationService.to_response_dict_batch(db, [conversation])[0]


@router.get("", response_model=List[ConversationResponse])
def list_conversations(
    skip: int = 0,
    limit: int = 20,
    current_user: User = Depends(get_current_user),
    db: Session = Depends(get_db),
):
    return ConversationService.list_conversations(db, current_user.id, skip, limit)


@router.get("/{conversation_id}/messages", response_model=List[MessageResponse])
def list_messages(
    conversation_id: uuid.UUID,
    skip: int = 0,
    limit: int = 50,
    current_user: User = Depends(get_current_user),
    db: Session = Depends(get_db),
):
    return ConversationService.list_messages(db, conversation_id, current_user.id, skip, limit)


@router.post("/{conversation_id}/messages", response_model=MessageResponse, status_code=status.HTTP_201_CREATED)
def send_message(
    conversation_id: uuid.UUID,
    payload: MessageCreate,
    current_user: User = Depends(get_current_user),
    db: Session = Depends(get_db),
):
    return ConversationService.send_message(db, conversation_id, current_user.id, payload.content)