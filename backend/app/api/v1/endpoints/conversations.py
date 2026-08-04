from fastapi import APIRouter, Depends, status
from sqlalchemy.orm import Session
from typing import List
import uuid

from app.core.dependencies import get_db, get_current_user
from app.models.user import User
from app.schemas.conversation import ConversationCreate, ConversationResponse, MessageCreate, MessageResponse, MarkReadResponse, UnreadCountResponse
from app.services.conversation_service import ConversationService
from fastapi import BackgroundTasks
from app.schemas.conversation import MessageUpdate, ReactionToggle
from app.services.conversation_service import NotMessageOwnerException
from app.websockets.connection_manager import manager

router = APIRouter(prefix="/conversations", tags=["chat"])


# NOTE (Important Change 2 / MF-3): this used to be defined TWICE in this
# file - once here without `viewer_id`, and a corrected copy further down
# with `viewer_id=current_user.id`. FastAPI matches the FIRST registered
# route for a given path+method, so the corrected copy was silently dead
# code - the Python name `start_conversation` was just rebound, with no
# error to notice. The fix is to keep exactly one definition, with the
# `viewer_id` fix folded in, in its original place - not to paste a second
# corrected copy below it.
@router.post("", response_model=ConversationResponse, status_code=status.HTTP_201_CREATED)
def start_conversation(
    payload: ConversationCreate,
    current_user: User = Depends(get_current_user),
    db: Session = Depends(get_db),
):
    conversation = ConversationService.get_or_create_direct_conversation(db, current_user.id, payload.user_id)
    return ConversationService.to_response_dict_batch(db, [conversation], viewer_id=current_user.id)[0]


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


async def _broadcast(participant_ids, payload: dict) -> None:
    for participant_id in participant_ids:
        await manager.send_to_user(participant_id, payload)


# NOTE (Important Change 1 / MF-4): `edit_message`, `remove_message`, and
# `react_to_message` below all broadcast their result over the WebSocket via
# `background_tasks.add_task(_broadcast, ...)`. This endpoint - the one
# that's actually used for the "send a message" flow whenever there's an
# attachment, or whenever the socket is down - did not. Recipients got
# nothing until the next poll for a REST-sent message, which is backwards
# (editing a message was more "real-time" than sending one). Fixed by
# broadcasting here the same way the other three already do.
@router.post("/{conversation_id}/messages", response_model=MessageResponse, status_code=status.HTTP_201_CREATED)
def send_message(
    conversation_id: uuid.UUID,
    payload: MessageCreate,
    background_tasks: BackgroundTasks,
    current_user: User = Depends(get_current_user),
    db: Session = Depends(get_db),
):
    message = ConversationService.send_message(db, conversation_id, current_user.id, payload.content, payload.attachment_ids)
    participant_ids = ConversationService.get_participant_ids(db, conversation_id)
    background_tasks.add_task(
        _broadcast,
        participant_ids,
        {
            "type": "message",
            "id": str(message["id"]),
            "conversation_id": str(conversation_id),
            "sender_id": str(message["sender_id"]),
            "content": message["content"],
            "created_at": message["created_at"].isoformat(),
        },
    )
    return message


@router.post("/{conversation_id}/read", response_model=MarkReadResponse)
def mark_conversation_read(
    conversation_id: uuid.UUID,
    current_user: User = Depends(get_current_user),
    db: Session = Depends(get_db),
):
    return ConversationService.mark_conversation_read(db, conversation_id, current_user.id)


@router.get("/{conversation_id}/unread-count", response_model=UnreadCountResponse)
def get_unread_count(
    conversation_id: uuid.UUID,
    current_user: User = Depends(get_current_user),
    db: Session = Depends(get_db),
):
    count = ConversationService.get_unread_count(db, conversation_id, current_user.id)
    return {"conversation_id": conversation_id, "unread_count": count}


@router.patch("/{conversation_id}/messages/{message_id}", response_model=MessageResponse)
def edit_message(
    conversation_id: uuid.UUID,
    message_id: uuid.UUID,
    payload: MessageUpdate,
    background_tasks: BackgroundTasks,
    current_user: User = Depends(get_current_user),
    db: Session = Depends(get_db),
):
    updated = ConversationService.update_message(db, conversation_id, message_id, current_user.id, payload.content)
    participant_ids = ConversationService.get_participant_ids(db, conversation_id)
    background_tasks.add_task(
        _broadcast,
        participant_ids,
        {
            "type": "message_updated",
            "id": str(updated["id"]),
            "conversation_id": str(conversation_id),
            "content": updated["content"],
            "updated_at": updated["updated_at"].isoformat() if updated["updated_at"] else None,
        },
    )
    return updated


@router.delete("/{conversation_id}/messages/{message_id}", status_code=status.HTTP_204_NO_CONTENT)
def remove_message(
    conversation_id: uuid.UUID,
    message_id: uuid.UUID,
    background_tasks: BackgroundTasks,
    current_user: User = Depends(get_current_user),
    db: Session = Depends(get_db),
):
    participant_ids = ConversationService.get_participant_ids(db, conversation_id)
    ConversationService.delete_message(db, conversation_id, message_id, current_user.id)
    background_tasks.add_task(
        _broadcast,
        participant_ids,
        {"type": "message_deleted", "id": str(message_id), "conversation_id": str(conversation_id)},
    )


@router.post("/{conversation_id}/messages/{message_id}/reactions", response_model=MessageResponse)
def react_to_message(
    conversation_id: uuid.UUID,
    message_id: uuid.UUID,
    payload: ReactionToggle,
    background_tasks: BackgroundTasks,
    current_user: User = Depends(get_current_user),
    db: Session = Depends(get_db),
):
    updated = ConversationService.toggle_reaction(db, conversation_id, message_id, current_user.id, payload.emoji)
    participant_ids = ConversationService.get_participant_ids(db, conversation_id)
    background_tasks.add_task(
        _broadcast,
        participant_ids,
        {
            "type": "reaction_updated",
            "id": str(updated["id"]),
            "conversation_id": str(conversation_id),
            "reactions": [
                {"emoji": r["emoji"], "user_ids": [str(uid) for uid in r["user_ids"]]}
                for r in updated["reactions"]
            ],
        },
    )
    return updated