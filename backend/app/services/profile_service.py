from sqlalchemy.orm import Session
from typing import Optional
import uuid

from app.models.user import User
from app.models.user_profile import UserProfile
from app.models.post import Post
from app.models.media import Media
from app.db.enums import PostStatus
from app.core.exceptions import UserNotFoundException, UsernameTakenException
from app.services.post_service import PostService
from app.services.like_service import LikeService


class ProfileService:

    @staticmethod
    def _get_user_and_profile(db: Session, user_id: uuid.UUID):
        user = db.query(User).filter(User.id == user_id, User.deleted_at.is_(None)).first()
        if not user:
            raise UserNotFoundException()
        profile = db.query(UserProfile).filter(UserProfile.user_id == user_id).first()
        return user, profile

    @staticmethod
    def _media_url(db: Session, media_id) -> Optional[str]:
        if not media_id:
            return None
        media = db.query(Media).filter(Media.id == media_id).first()
        return media.url if media else None

    @staticmethod
    def _build_response(db: Session, user: User, profile: UserProfile, posts: list, viewer_id: Optional[uuid.UUID]) -> dict:
        # Bug fix: posts used to be passed through as raw ORM `Post`
        # objects, which don't carry `author_username` / `media` /
        # `liked_by_me` as real attributes - Pydantic silently filled
        # those with their defaults (None / [] / False) instead of
        # erroring, so the profile tab showed "Unknown user", no
        # attachments, and never-liked hearts regardless of reality.
        # Routing through PostService's batched shaping fixes that and
        # keeps profile posts byte-for-byte consistent with the feed.
        liked_ids = (
            LikeService.get_liked_post_ids(db, viewer_id, [p.id for p in posts])
            if viewer_id else set()
        )
        post_dicts = PostService.to_response_dict_batch(db, posts, liked_ids)

        return {
            "user_id": user.id,
            "username": user.username,
            "display_name": profile.display_name if profile else None,
            "bio": profile.bio if profile else None,
            "avatar_url": ProfileService._media_url(db, profile.profile_picture_id if profile else None),
            "cover_photo_url": ProfileService._media_url(db, profile.cover_photo_id if profile else None),
            "follower_count": profile.follower_count if profile else 0,
            "following_count": profile.following_count if profile else 0,
            "post_count": profile.post_count if profile else 0,
            "posts": post_dicts,
        }

    @staticmethod
    def get_public_profile(db: Session, user_id: uuid.UUID, viewer_id: Optional[uuid.UUID] = None) -> dict:
        """Active posts only. No archived posts, no edit affordances implied.
        `viewer_id` (if the request came from a logged-in user) is used
        only to compute their own `liked_by_me` state on each post."""
        user, profile = ProfileService._get_user_and_profile(db, user_id)
        posts = (
            db.query(Post)
            .filter(Post.author_id == user_id, Post.status == PostStatus.active, Post.deleted_at.is_(None))
            .order_by(Post.created_at.desc())
            .all()
        )
        return ProfileService._build_response(db, user, profile, posts, viewer_id)

    @staticmethod
    def get_own_profile(db: Session, user_id: uuid.UUID) -> dict:
        """Includes archived posts, since only the owner should see them here."""
        user, profile = ProfileService._get_user_and_profile(db, user_id)
        posts = (
            db.query(Post)
            .filter(
                Post.author_id == user_id,
                Post.status.in_([PostStatus.active, PostStatus.archived]),
                Post.deleted_at.is_(None),
            )
            .order_by(Post.created_at.desc())
            .all()
        )
        return ProfileService._build_response(db, user, profile, posts, viewer_id=user_id)

    @staticmethod
    def _get_or_create_profile(db: Session, user_id: uuid.UUID) -> UserProfile:
        profile = db.query(UserProfile).filter(UserProfile.user_id == user_id).first()
        if not profile:
            profile = UserProfile(user_id=user_id)
            db.add(profile)
        return profile

    @staticmethod
    def update_bio(db: Session, user_id: uuid.UUID, bio: str) -> UserProfile:
        profile = ProfileService._get_or_create_profile(db, user_id)
        profile.bio = bio
        db.add(profile)
        db.commit()
        db.refresh(profile)
        return profile

    @staticmethod
    def update_profile(
        db: Session,
        user_id: uuid.UUID,
        username: Optional[str] = None,
        display_name: Optional[str] = None,
        bio: Optional[str] = None,
    ) -> None:
        """Backs the Edit Profile modal - updates whichever fields were
        actually sent. `username` lives on `User`, everything else on
        `UserProfile`, so this is the one place that writes to both."""
        user = db.query(User).filter(User.id == user_id, User.deleted_at.is_(None)).first()
        if not user:
            raise UserNotFoundException()

        if username is not None and username != user.username:
            taken = (
                db.query(User)
                .filter(User.username == username, User.id != user_id)
                .first()
            )
            if taken:
                raise UsernameTakenException()
            user.username = username
            db.add(user)

        if display_name is not None or bio is not None:
            profile = ProfileService._get_or_create_profile(db, user_id)
            if display_name is not None:
                profile.display_name = display_name
            if bio is not None:
                profile.bio = bio
            db.add(profile)

        db.commit()