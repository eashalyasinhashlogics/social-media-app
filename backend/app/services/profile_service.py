from sqlalchemy.orm import Session
import uuid

from app.models.user import User
from app.models.user_profile import UserProfile
from app.models.post import Post
from app.models.media import Media
from app.db.enums import PostStatus
from app.core.exceptions import UserNotFoundException


class ProfileService:

    @staticmethod
    def _get_user_and_profile(db: Session, user_id: uuid.UUID):
        user = db.query(User).filter(User.id == user_id, User.deleted_at.is_(None)).first()
        if not user:
            raise UserNotFoundException()
        profile = db.query(UserProfile).filter(UserProfile.user_id == user_id).first()
        return user, profile

    @staticmethod
    def _avatar_url(db: Session, profile: UserProfile) -> str | None:
        if not profile or not profile.profile_picture_id:
            return None
        media = db.query(Media).filter(Media.id == profile.profile_picture_id).first()
        return media.url if media else None

    @staticmethod
    def _build_response(db: Session, user: User, profile: UserProfile, posts: list) -> dict:
        return {
            "user_id": user.id,
            "username": user.username,
            "bio": profile.bio if profile else None,
            "avatar_url": ProfileService._avatar_url(db, profile),
            "follower_count": profile.follower_count if profile else 0,
            "following_count": profile.following_count if profile else 0,
            "post_count": profile.post_count if profile else 0,
            "posts": posts,
        }

    @staticmethod
    def get_public_profile(db: Session, user_id: uuid.UUID) -> dict:
        """Active posts only. No archived posts, no edit affordances implied."""
        user, profile = ProfileService._get_user_and_profile(db, user_id)
        posts = (
            db.query(Post)
            .filter(Post.author_id == user_id, Post.status == PostStatus.active, Post.deleted_at.is_(None))
            .order_by(Post.created_at.desc())
            .all()
        )
        return ProfileService._build_response(db, user, profile, posts)

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
        return ProfileService._build_response(db, user, profile, posts)

    @staticmethod
    def update_bio(db: Session, user_id: uuid.UUID, bio: str) -> UserProfile:
        profile = db.query(UserProfile).filter(UserProfile.user_id == user_id).first()
        if not profile:
            profile = UserProfile(user_id=user_id, bio=bio)
            db.add(profile)
        else:
            profile.bio = bio
            db.add(profile)
        db.commit()
        db.refresh(profile)
        return profile