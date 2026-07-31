from sqlalchemy.orm import Session
from typing import List
import uuid

from app.models.follow import Follow
from app.models.user import User
from app.models.user_profile import UserProfile
from app.models.media import Media
from app.core.exceptions import UserNotFoundException
from fastapi import HTTPException, status
from app.services.notification_service import NotificationService

class CannotFollowSelfException(HTTPException):
    def __init__(self):
        super().__init__(status_code=status.HTTP_400_BAD_REQUEST, detail="You cannot follow yourself")


class AlreadyFollowingException(HTTPException):
    def __init__(self):
        super().__init__(status_code=status.HTTP_409_CONFLICT, detail="You are already following this user")


class NotFollowingException(HTTPException):
    def __init__(self):
        super().__init__(status_code=status.HTTP_404_NOT_FOUND, detail="You are not following this user")


class FollowService:

    @staticmethod
    def _get_active_user_or_404(db: Session, user_id: uuid.UUID) -> User:
        user = db.query(User).filter(User.id == user_id, User.deleted_at.is_(None)).first()
        if not user:
            raise UserNotFoundException()
        return user

    @staticmethod
    def _get_or_create_profile(db: Session, user_id: uuid.UUID) -> UserProfile:
        profile = db.query(UserProfile).filter(UserProfile.user_id == user_id).first()
        if not profile:
            profile = UserProfile(user_id=user_id)
            db.add(profile)
        return profile

    @staticmethod
    def follow(db: Session, follower_id: uuid.UUID, following_id: uuid.UUID) -> dict:
        if follower_id == following_id:
            raise CannotFollowSelfException()

        FollowService._get_active_user_or_404(db, following_id)

        existing = (
            db.query(Follow)
            .filter(Follow.follower_id == follower_id, Follow.following_id == following_id)
            .first()
        )
        if existing:
            raise AlreadyFollowingException()

        db.add(Follow(follower_id=follower_id, following_id=following_id))

        follower_profile = FollowService._get_or_create_profile(db, follower_id)
        following_profile = FollowService._get_or_create_profile(db, following_id)
        follower_profile.following_count += 1
        following_profile.follower_count += 1
        db.add(follower_profile)
        db.add(following_profile)

        db.commit()
        db.refresh(following_profile)
        db.refresh(follower_profile)

        NotificationService.notify_follow(db, following_id, follower_id)

        return {
            "following": True,
            "follower_count": following_profile.follower_count,
            "following_count": follower_profile.following_count,
        }

    @staticmethod
    def ensure_following(db: Session, follower_id: uuid.UUID, following_id: uuid.UUID) -> bool:
        """Idempotent, non-raising variant of follow() for system-triggered
        follows (e.g. auto-follow when a friend request is accepted).
        Does not commit - the caller (FriendService.accept_request) commits
        once alongside the Friendship row so both writes land atomically.
        Returns True if a new Follow row was created, False if the pair
        was already following (no duplicate row, no double-counted stats)."""
        if follower_id == following_id:
            return False

        existing = (
            db.query(Follow)
            .filter(Follow.follower_id == follower_id, Follow.following_id == following_id)
            .first()
        )
        if existing:
            return False

        db.add(Follow(follower_id=follower_id, following_id=following_id))

        follower_profile = FollowService._get_or_create_profile(db, follower_id)
        following_profile = FollowService._get_or_create_profile(db, following_id)
        follower_profile.following_count += 1
        following_profile.follower_count += 1
        db.add(follower_profile)
        db.add(following_profile)

        NotificationService.notify_follow(db, following_id, follower_id)
        return True

    @staticmethod
    def unfollow(db: Session, follower_id: uuid.UUID, following_id: uuid.UUID) -> dict:
        existing = (
            db.query(Follow)
            .filter(Follow.follower_id == follower_id, Follow.following_id == following_id)
            .first()
        )
        if not existing:
            raise NotFollowingException()

        db.delete(existing)

        follower_profile = FollowService._get_or_create_profile(db, follower_id)
        following_profile = FollowService._get_or_create_profile(db, following_id)
        follower_profile.following_count = max(follower_profile.following_count - 1, 0)
        following_profile.follower_count = max(following_profile.follower_count - 1, 0)
        db.add(follower_profile)
        db.add(following_profile)

        db.commit()
        db.refresh(following_profile)
        db.refresh(follower_profile)

        return {
            "following": False,
            "follower_count": following_profile.follower_count,
            "following_count": follower_profile.following_count,
        }

    @staticmethod
    def is_following(db: Session, follower_id: uuid.UUID, following_id: uuid.UUID) -> bool:
        return (
            db.query(Follow)
            .filter(Follow.follower_id == follower_id, Follow.following_id == following_id)
            .first()
            is not None
        )

    @staticmethod
    def get_following_ids(db: Session, follower_id: uuid.UUID) -> List[uuid.UUID]:
        """Used by the feed to filter posts down to who the viewer follows."""
        rows = db.query(Follow.following_id).filter(Follow.follower_id == follower_id).all()
        return [row[0] for row in rows]

    # ── Response shaping (mirrors PostService's batched approach) ──────

    @staticmethod
    def _to_follower_user_list(db: Session, user_ids: List[uuid.UUID]) -> list:
        if not user_ids:
            return []

        users_by_id = {u.id: u for u in db.query(User).filter(User.id.in_(user_ids)).all()}
        profiles_by_user_id = {
            p.user_id: p for p in db.query(UserProfile).filter(UserProfile.user_id.in_(user_ids)).all()
        }
        picture_ids = {p.profile_picture_id for p in profiles_by_user_id.values() if p.profile_picture_id}
        media_by_id = {
            m.id: m for m in db.query(Media).filter(Media.id.in_(picture_ids)).all()
        } if picture_ids else {}

        results = []
        for user_id in user_ids:
            user = users_by_id.get(user_id)
            if not user:
                continue
            profile = profiles_by_user_id.get(user_id)
            avatar = media_by_id.get(profile.profile_picture_id) if profile and profile.profile_picture_id else None
            results.append({
                "id": user.id,
                "username": user.username,
                "display_name": profile.display_name if profile else None,
                "avatar_url": avatar.url if avatar else None,
            })
        return results

    @staticmethod
    def list_followers(db: Session, user_id: uuid.UUID, skip: int = 0, limit: int = 20) -> list:
        FollowService._get_active_user_or_404(db, user_id)
        follower_ids = [
            row[0]
            for row in (
                db.query(Follow.follower_id)
                .filter(Follow.following_id == user_id)
                .order_by(Follow.created_at.desc())
                .offset(skip)
                .limit(limit)
                .all()
            )
        ]
        return FollowService._to_follower_user_list(db, follower_ids)

    @staticmethod
    def list_following(db: Session, user_id: uuid.UUID, skip: int = 0, limit: int = 20) -> list:
        FollowService._get_active_user_or_404(db, user_id)
        following_ids = [
            row[0]
            for row in (
                db.query(Follow.following_id)
                .filter(Follow.follower_id == user_id)
                .order_by(Follow.created_at.desc())
                .offset(skip)
                .limit(limit)
                .all()
            )
        ]
        return FollowService._to_follower_user_list(db, following_ids)