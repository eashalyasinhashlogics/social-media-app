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