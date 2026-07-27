from sqlalchemy.orm import Session
from fastapi import UploadFile
import uuid

from app.models.media import Media
from app.models.user_profile import UserProfile
from app.models.post import Post
from app.db.enums import MediaType
from app.core.storage import upload_file_to_s3
from app.core.exceptions import (
    InvalidFileTypeException,
    FileTooLargeException,
    PostNotFoundException,
    NotPostOwnerException,
)

ALLOWED_IMAGE_TYPES = {"image/jpeg", "image/png", "image/webp", "image/gif"}
ALLOWED_VIDEO_TYPES = {"video/mp4"}
MAX_AVATAR_SIZE_BYTES = 5 * 1024 * 1024        # 5 MB
MAX_COVER_PHOTO_SIZE_BYTES = 8 * 1024 * 1024   # 8 MB (larger images, banner-sized)
MAX_POST_MEDIA_SIZE_BYTES = 25 * 1024 * 1024   # 25 MB


class MediaService:

    @staticmethod
    async def _read_and_validate(file: UploadFile, allowed_types: set, max_size: int) -> bytes:
        if file.content_type not in allowed_types:
            raise InvalidFileTypeException(allowed_types)

        file_bytes = await file.read()
        if len(file_bytes) > max_size:
            raise FileTooLargeException(max_size)

        return file_bytes

    @staticmethod
    async def upload_avatar(db: Session, uploader_id: uuid.UUID, file: UploadFile) -> Media:
        file_bytes = await MediaService._read_and_validate(
            file, allowed_types=ALLOWED_IMAGE_TYPES, max_size=MAX_AVATAR_SIZE_BYTES
        )

        url, key = upload_file_to_s3(file_bytes, file.content_type, folder="avatars")

        media = Media(
            uploader_id=uploader_id,
            post_id=None,
            url=url,
            public_id=key,
            media_type=MediaType.avatar,
            file_size=len(file_bytes),
        )
        db.add(media)
        db.flush()  # get media.id before linking it to the profile below

        profile = db.query(UserProfile).filter(UserProfile.user_id == uploader_id).first()
        if not profile:
            # A brand-new user may not have a UserProfile row yet (it's
            # only created lazily on first bio/avatar/cover edit) -
            # without this the very first avatar upload would silently
            # do nothing.
            profile = UserProfile(user_id=uploader_id)
            db.add(profile)
            db.flush()
        profile.profile_picture_id = media.id
        db.add(profile)

        db.commit()
        db.refresh(media)
        return media

    @staticmethod
    async def upload_cover_photo(db: Session, uploader_id: uuid.UUID, file: UploadFile) -> Media:
        file_bytes = await MediaService._read_and_validate(
            file, allowed_types=ALLOWED_IMAGE_TYPES, max_size=MAX_COVER_PHOTO_SIZE_BYTES
        )

        url, key = upload_file_to_s3(file_bytes, file.content_type, folder="covers")

        media = Media(
            uploader_id=uploader_id,
            post_id=None,
            url=url,
            public_id=key,
            media_type=MediaType.cover,
            file_size=len(file_bytes),
        )
        db.add(media)
        db.flush()  # get media.id before linking it to the profile below

        profile = db.query(UserProfile).filter(UserProfile.user_id == uploader_id).first()
        if not profile:
            profile = UserProfile(user_id=uploader_id)
            db.add(profile)
            db.flush()
        profile.cover_photo_id = media.id
        db.add(profile)

        db.commit()
        db.refresh(media)
        return media

    @staticmethod
    async def upload_post_media(db: Session, uploader_id: uuid.UUID, post_id: uuid.UUID, file: UploadFile) -> Media:
        post = db.query(Post).filter(Post.id == post_id, Post.deleted_at.is_(None)).first()
        if not post:
            raise PostNotFoundException()
        if post.author_id != uploader_id:
            raise NotPostOwnerException()

        allowed = ALLOWED_IMAGE_TYPES | ALLOWED_VIDEO_TYPES
        file_bytes = await MediaService._read_and_validate(
            file, allowed_types=allowed, max_size=MAX_POST_MEDIA_SIZE_BYTES
        )

        url, key = upload_file_to_s3(file_bytes, file.content_type, folder="posts")
        media_type = MediaType.video if file.content_type in ALLOWED_VIDEO_TYPES else MediaType.image

        media = Media(
            uploader_id=uploader_id,
            post_id=post_id,
            url=url,
            public_id=key,
            media_type=media_type,
            file_size=len(file_bytes),
        )
        db.add(media)
        db.commit()
        db.refresh(media)
        return media

        @staticmethod
        def get_participant_ids(db: Session, conversation_id: uuid.UUID) -> List[uuid.UUID]:
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
        def to_response_dict_batch(db: Session, conversations: List[Conversation], viewer_id: uuid.UUID = None) -> list:
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