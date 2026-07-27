from fastapi import APIRouter, WebSocket, WebSocketDisconnect, Query
from sqlalchemy.orm import Session
from jose import JWTError
from typing import Optional
import uuid

from app.db.database import SessionLocal
from app.core.security import decode_token
from app.config import ACCESS_TOKEN_COOKIE_NAME
from app.models.user import User
from app.services.conversation_service import (
    ConversationService,
    ConversationNotFoundException,
    NotConversationParticipantException,
)
from app.websockets.connection_manager import manager

router = APIRouter()


async def _authenticate_ws(websocket: WebSocket, token: Optional[str]) -> Optional[User]:
    """Browser WebSocket clients can't set an Authorization header, so the
    access token is passed as a query param (?token=...) - falling back to
    the httpOnly cookie for same-origin connections that don't pass one."""
    raw_token = token or websocket.cookies.get(ACCESS_TOKEN_COOKIE_NAME)
    if not raw_token:
        return None
    try:
        payload = decode_token(raw_token)
    except JWTError:
        return None

    user_id = payload.get("sub")
    if not user_id:
        return None

    db: Session = SessionLocal()
    try:
        return db.query(User).filter(User.id == user_id).first()
    finally:
        db.close()


@router.websocket("/ws/chat")
async def chat_websocket(websocket: WebSocket, token: Optional[str] = Query(default=None)):
    user = await _authenticate_ws(websocket, token)
    if not user:
        # Reject before accept() - the client sees this as a failed
        # handshake (WebSocketDisconnect), same as an HTTP 401 would read.
        await websocket.close(code=1008)  # policy violation
        return

    await websocket.accept()
    await manager.connect(user.id, websocket)

    try:
        while True:
            data = await websocket.receive_json()
            conversation_id_raw = data.get("conversation_id")
            content = data.get("content")

            if not conversation_id_raw or not content:
                await websocket.send_json({"type": "error", "detail": "conversation_id and content are required"})
                continue

            try:
                conversation_id = uuid.UUID(str(conversation_id_raw))
            except ValueError:
                await websocket.send_json({"type": "error", "detail": "conversation_id must be a valid UUID"})
                continue

            db: Session = SessionLocal()
            try:
                # Checked explicitly (rather than just catching the
                # exception from send_message) so a bad message never even
                # reaches persistence - and so the connection stays open
                # instead of being torn down. The same socket may
                # legitimately be used to message several conversations.
                if not ConversationService.is_participant(db, conversation_id, user.id):
                    await websocket.send_json({"type": "error", "detail": "You are not a participant in this conversation"})
                    continue

                try:
                    message = ConversationService.send_message(db, conversation_id, user.id, content)
                except (ConversationNotFoundException, NotConversationParticipantException) as exc:
                    await websocket.send_json({"type": "error", "detail": exc.detail})
                    continue

                participant_ids = ConversationService.get_participant_ids(db, conversation_id)
            finally:
                db.close()

            payload = {
                "type": "message",
                "id": str(message.id),
                "conversation_id": str(message.conversation_id),
                "sender_id": str(message.sender_id),
                "content": message.content,
                "created_at": message.created_at.isoformat(),
            }
            for participant_id in participant_ids:
                await manager.send_to_user(participant_id, payload)

    except WebSocketDisconnect:
        manager.disconnect(user.id, websocket)