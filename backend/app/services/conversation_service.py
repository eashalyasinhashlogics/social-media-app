from sqlalchemy.orm import Session
from sqlalchemy import func
from fastapi import HTTPException, status
from typing import List, Optional
from datetime import datetime
import uuid

from app.models.conversation import Conversation
from app.models.conversation_participant import ConversationParticipant
from app.models.message import Message
from app.models.message_read import MessageRead
from app.models.user import User
from app.db.enums import ConversationType
from app.core.exceptions import UserNotFoundException


class CannotMessageSelfException(HTTPException):
    def __init__(self):
        super().__init__(status_code=status.HTTP_400_BAD_REQUEST, detail="You cannot start a conversation with yourself")


class ConversationNotFoundException(HTTPException):
    def __init__(self):
        super().__init__(status_code=status.HTTP_404_NOT_FOUND, detail="Conversation not found")


class NotConversationParticipantException(HTTPException):
    def __init__(self):
        super().__init__(status_code=status.HTTP_403_FORBIDDEN, detail="You are not a participant in this conversation")


class ConversationService:

    @staticmethod
    def _get_active_user_or_404(db: Session, user_id: uuid.UUID) -> User:
        user = db.query(User).filter(User.id == user_id, User.deleted_at.is_(None)).first()
        if not user:
            raise UserNotFoundException()
        return user

    @staticmethod
    def _get_conversation_or_404(db: Session, conversation_id: uuid.UUID) -> Conversation:
        conversation = db.query(Conversation).filter(Conversation.id == conversation_id).first()
        if not conversation:
            raise ConversationNotFoundException()
        return conversation

    @staticmethod
    def is_participant(db: Session, conversation_id: uuid.UUID, user_id: uuid.UUID) -> bool:
        return (
            db.query(ConversationParticipant)
            .filter(
                ConversationParticipant.conversation_id == conversation_id,
                ConversationParticipant.user_id == user_id,
                ConversationParticipant.left_at.is_(None),
            )
            .first()
            is not None
        )

    @staticmethod
    def get_participant_ids(db: Session, conversation_id: uuid.UUID) -> List[uuid.UUID]:
        """Active (not-left) participant user ids for a conversation.
        Used by the WebSocket layer to know who to broadcast a new message to."""
        rows = (
            db.query(ConversationParticipant.user_id)
            .filter(
                ConversationParticipant.conversation_id == conversation_id,
                ConversationParticipant.left_at.is_(None),
            )
            .all()
        )
        return [row[0] for row in rows]

    @staticmethod
    def get_or_create_direct_conversation(db: Session, user_a_id: uuid.UUID, user_b_id: uuid.UUID) -> Conversation:
        """Dedupes by design: relies on the fact that this is the *only*
        place a `direct` conversation is ever created, and direct
        conversations never gain a third participant - so "type == direct
        AND both user ids show up as participants" is enough to prove
        it's the same thread, without needing a stricter participant-count
        check."""
        if user_a_id == user_b_id:
            raise CannotMessageSelfException()

        ConversationService._get_active_user_or_404(db, user_b_id)

        existing_id = (
            db.query(Conversation.id)
            .join(ConversationParticipant, ConversationParticipant.conversation_id == Conversation.id)
            .filter(
                Conversation.type == ConversationType.direct,
                ConversationParticipant.user_id.in_([user_a_id, user_b_id]),
            )
            .group_by(Conversation.id)
            .having(func.count(func.distinct(ConversationParticipant.user_id)) == 2)
            .scalar()
        )
        if existing_id:
            return db.query(Conversation).filter(Conversation.id == existing_id).first()

        conversation = Conversation(type=ConversationType.direct)
        db.add(conversation)
        db.flush()  # need conversation.id before creating participant rows

        db.add(ConversationParticipant(conversation_id=conversation.id, user_id=user_a_id))
        db.add(ConversationParticipant(conversation_id=conversation.id, user_id=user_b_id))

        db.commit()
        db.refresh(conversation)
        return conversation

    @staticmethod
    def list_conversations(db: Session, user_id: uuid.UUID, skip: int = 0, limit: int = 20) -> list:
        conversations = (
            db.query(Conversation)
            .join(ConversationParticipant, ConversationParticipant.conversation_id == Conversation.id)
            .filter(ConversationParticipant.user_id == user_id, ConversationParticipant.left_at.is_(None))
            .order_by(Conversation.last_message_at.desc().nullslast(), Conversation.created_at.desc())
            .offset(skip)
            .limit(limit)
            .all()
        )
        return ConversationService.to_response_dict_batch(db, conversations, viewer_id=user_id)

    @staticmethod
    def send_message(db: Session, conversation_id: uuid.UUID, sender_id: uuid.UUID, content: str) -> Message:
        ConversationService._get_conversation_or_404(db, conversation_id)
        if not ConversationService.is_participant(db, conversation_id, sender_id):
            raise NotConversationParticipantException()

        message = Message(conversation_id=conversation_id, sender_id=sender_id, content=content)
        db.add(message)
        db.flush()  # need message.id/created_at before stamping the conversation

        conversation = db.query(Conversation).filter(Conversation.id == conversation_id).first()
        conversation.last_message_id = message.id
        conversation.last_message_at = message.created_at
        db.add(conversation)

        db.commit()
        db.refresh(message)
        return message

    @staticmethod
    def list_messages(db: Session, conversation_id: uuid.UUID, user_id: uuid.UUID, skip: int = 0, limit: int = 50) -> list:
        ConversationService._get_conversation_or_404(db, conversation_id)
        if not ConversationService.is_participant(db, conversation_id, user_id):
            raise NotConversationParticipantException()

        return (
            db.query(Message)
            .filter(Message.conversation_id == conversation_id)
            .order_by(Message.created_at.desc())
            .offset(skip)
            .limit(limit)
            .all()
        )

    # ── Response shaping (mirrors PostService's batched approach) ──────

    @staticmethod
    def to_response_dict_batch(db: Session, conversations: List[Conversation], viewer_id: Optional[uuid.UUID] = None) -> list:
        if not conversations:
            return []

        conv_ids = [c.id for c in conversations]

        participants_by_conv: dict = {}
        for row in (
            db.query(ConversationParticipant.conversation_id, ConversationParticipant.user_id)
            .filter(ConversationParticipant.conversation_id.in_(conv_ids))
            .all()
        ):
            participants_by_conv.setdefault(row.conversation_id, []).append(row.user_id)

        last_message_ids = [c.last_message_id for c in conversations if c.last_message_id]
        messages_by_id = (
            {m.id: m for m in db.query(Message).filter(Message.id.in_(last_message_ids)).all()}
            if last_message_ids else {}
        )

        # One batched query for all conversations' unread counts instead of
        # querying per conversation - same N+1 avoidance as PostService.
        unread_counts = (
            ConversationService.get_unread_counts_batch(db, conv_ids, viewer_id)
            if viewer_id else {c.id: 0 for c in conversations}
        )

        results = []
        for c in conversations:
            results.append({
                "id": c.id,
                "type": c.type.value if hasattr(c.type, "value") else c.type,
                "participant_ids": participants_by_conv.get(c.id, []),
                "last_message": messages_by_id.get(c.last_message_id) if c.last_message_id else None,
                "last_message_at": c.last_message_at,
                "unread_count": unread_counts.get(c.id, 0),
                "created_at": c.created_at,
                "updated_at": c.updated_at,
            })
        return results

    # ── Read receipts / unread counts (Step 7) ─────────────────────────

    @staticmethod
    def get_unread_count(db: Session, conversation_id: uuid.UUID, user_id: uuid.UUID) -> int:
        ConversationService._get_conversation_or_404(db, conversation_id)
        if not ConversationService.is_participant(db, conversation_id, user_id):
            raise NotConversationParticipantException()

        read_message_ids = db.query(MessageRead.message_id).filter(MessageRead.user_id == user_id)
        count = (
            db.query(func.count(Message.id))
            .filter(
                Message.conversation_id == conversation_id,
                Message.sender_id != user_id,  # you don't owe yourself a read receipt
                ~Message.id.in_(read_message_ids),
            )
            .scalar()
        )
        return count or 0

    @staticmethod
    def get_unread_counts_batch(db: Session, conversation_ids: List[uuid.UUID], user_id: uuid.UUID) -> dict:
        """One query for every conversation's unread count, keyed by
        conversation_id - the same batching pattern to_response_dict_batch
        already uses for authors/media, so listing conversations never
        pays an N+1 cost for unread badges."""
        if not conversation_ids:
            return {}

        read_message_ids = db.query(MessageRead.message_id).filter(MessageRead.user_id == user_id)
        rows = (
            db.query(Message.conversation_id, func.count(Message.id))
            .filter(
                Message.conversation_id.in_(conversation_ids),
                Message.sender_id != user_id,
                ~Message.id.in_(read_message_ids),
            )
            .group_by(Message.conversation_id)
            .all()
        )
        counts = {conv_id: 0 for conv_id in conversation_ids}
        for conv_id, count in rows:
            counts[conv_id] = count
        return counts

    @staticmethod
    def mark_conversation_read(db: Session, conversation_id: uuid.UUID, user_id: uuid.UUID) -> dict:
        ConversationService._get_conversation_or_404(db, conversation_id)
        if not ConversationService.is_participant(db, conversation_id, user_id):
            raise NotConversationParticipantException()

        already_read_ids = {
            row[0] for row in
            db.query(MessageRead.message_id)
            .join(Message, Message.id == MessageRead.message_id)
            .filter(Message.conversation_id == conversation_id, MessageRead.user_id == user_id)
            .all()
        }

        unread_message_ids = [
            row[0] for row in
            db.query(Message.id)
            .filter(Message.conversation_id == conversation_id, Message.sender_id != user_id)
            .all()
            if row[0] not in already_read_ids
        ]

        now = datetime.utcnow()
        for message_id in unread_message_ids:
            db.add(MessageRead(message_id=message_id, user_id=user_id, read_at=now))

        db.commit()
        return {"marked_read": len(unread_message_ids)}