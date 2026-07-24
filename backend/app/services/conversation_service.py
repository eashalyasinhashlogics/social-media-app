from sqlalchemy.orm import Session
from sqlalchemy import func
from fastapi import HTTPException, status
from typing import List
import uuid

from app.models.conversation import Conversation
from app.models.conversation_participant import ConversationParticipant
from app.models.message import Message
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
        return ConversationService.to_response_dict_batch(db, conversations)

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
    def to_response_dict_batch(db: Session, conversations: List[Conversation]) -> list:
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

        results = []
        for c in conversations:
            results.append({
                "id": c.id,
                "type": c.type.value if hasattr(c.type, "value") else c.type,
                "participant_ids": participants_by_conv.get(c.id, []),
                "last_message": messages_by_id.get(c.last_message_id) if c.last_message_id else None,
                "last_message_at": c.last_message_at,
                "created_at": c.created_at,
                "updated_at": c.updated_at,
            })
        return results