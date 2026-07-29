from sqlalchemy.orm import Session
from typing import Optional, List
import uuid

from fastapi import HTTPException, status

from app.models.notification import Notification
from app.models.user import User
from app.models.user_profile import UserProfile
from app.models.media import Media
from app.models.post import Post
from app.models.comment import Comment
from app.db.enums import NotificationType


class NotificationNotFoundException(HTTPException):
    def __init__(self):
        super().__init__(status_code=status.HTTP_404_NOT_FOUND, detail="Notification not found")


class NotificationService:

    # ── Creation — called from other services right after their own
    # commit, mirroring how FollowService/FriendService already update
    # denormalized counters inline. ─────────────────────────────────

    @staticmethod
    def _create(
        db: Session,
        recipient_id: uuid.UUID,
        actor_id: Optional[uuid.UUID],
        type_: NotificationType,
        post_id: Optional[uuid.UUID] = None,
        comment_id: Optional[uuid.UUID] = None,
        friend_request_id: Optional[uuid.UUID] = None,
    ) -> None:
        # Never notify yourself (e.g. commenting on your own post).
        if actor_id and actor_id == recipient_id:
            return
        db.add(Notification(
            recipient_id=recipient_id,
            actor_id=actor_id,
            type=type_,
            post_id=post_id,
            comment_id=comment_id,
            friend_request_id=friend_request_id,
        ))
        db.commit()

    @staticmethod
    def notify_like(db: Session, recipient_id: uuid.UUID, actor_id: uuid.UUID, post_id: uuid.UUID) -> None:
        NotificationService._create(db, recipient_id, actor_id, NotificationType.like, post_id=post_id)

    @staticmethod
    def notify_comment(db: Session, recipient_id: uuid.UUID, actor_id: uuid.UUID, post_id: uuid.UUID, comment_id: uuid.UUID) -> None:
        NotificationService._create(db, recipient_id, actor_id, NotificationType.comment, post_id=post_id, comment_id=comment_id)

    @staticmethod
    def notify_reply(db: Session, recipient_id: uuid.UUID, actor_id: uuid.UUID, post_id: uuid.UUID, comment_id: uuid.UUID) -> None:
        NotificationService._create(db, recipient_id, actor_id, NotificationType.reply, post_id=post_id, comment_id=comment_id)

    @staticmethod
    def notify_friend_request(db: Session, recipient_id: uuid.UUID, actor_id: uuid.UUID, friend_request_id: uuid.UUID) -> None:
        NotificationService._create(db, recipient_id, actor_id, NotificationType.friend_request, friend_request_id=friend_request_id)

    @staticmethod
    def notify_friend_accept(db: Session, recipient_id: uuid.UUID, actor_id: uuid.UUID, friend_request_id: uuid.UUID) -> None:
        NotificationService._create(db, recipient_id, actor_id, NotificationType.friend_accept, friend_request_id=friend_request_id)

    @staticmethod
    def notify_follow(db: Session, recipient_id: uuid.UUID, actor_id: uuid.UUID) -> None:
        NotificationService._create(db, recipient_id, actor_id, NotificationType.follow)

    # ── Reads ────────────────────────────────────────────────────────

    @staticmethod
    def list_for_user(db: Session, user_id: uuid.UUID, skip: int = 0, limit: int = 30) -> list:
        notifications = (
            db.query(Notification)
            .filter(Notification.recipient_id == user_id)
            .order_by(Notification.created_at.desc())
            .offset(skip)
            .limit(limit)
            .all()
        )
        return NotificationService._to_response_batch(db, notifications)

    @staticmethod
    def unread_count(db: Session, user_id: uuid.UUID) -> int:
        return (
            db.query(Notification)
            .filter(Notification.recipient_id == user_id, Notification.is_read.is_(False))
            .count()
        )

    @staticmethod
    def mark_read(db: Session, notification_id: uuid.UUID, user_id: uuid.UUID) -> None:
        notif = (
            db.query(Notification)
            .filter(Notification.id == notification_id, Notification.recipient_id == user_id)
            .first()
        )
        if not notif:
            raise NotificationNotFoundException()
        notif.is_read = True
        db.add(notif)
        db.commit()

    @staticmethod
    def mark_all_read(db: Session, user_id: uuid.UUID) -> int:
        rows = (
            db.query(Notification)
            .filter(Notification.recipient_id == user_id, Notification.is_read.is_(False))
            .all()
        )
        for n in rows:
            n.is_read = True
            db.add(n)
        db.commit()
        return len(rows)

    # ── Response shaping — batched like FollowService._to_follower_user_list ──

    @staticmethod
    def _to_response_batch(db: Session, notifications: List[Notification]) -> list:
        if not notifications:
            return []

        actor_ids = {n.actor_id for n in notifications if n.actor_id}
        users_by_id = {u.id: u for u in db.query(User).filter(User.id.in_(actor_ids)).all()} if actor_ids else {}
        profiles_by_user_id = {
            p.user_id: p for p in db.query(UserProfile).filter(UserProfile.user_id.in_(actor_ids)).all()
        } if actor_ids else {}
        picture_ids = {p.profile_picture_id for p in profiles_by_user_id.values() if p.profile_picture_id}
        media_by_id = {m.id: m for m in db.query(Media).filter(Media.id.in_(picture_ids)).all()} if picture_ids else {}

        post_ids = {n.post_id for n in notifications if n.post_id}
        posts_by_id = {p.id: p for p in db.query(Post).filter(Post.id.in_(post_ids)).all()} if post_ids else {}

        comment_ids = {n.comment_id for n in notifications if n.comment_id}
        comments_by_id = {c.id: c for c in db.query(Comment).filter(Comment.id.in_(comment_ids)).all()} if comment_ids else {}

        results = []
        for n in notifications:
            actor = None
            if n.actor_id and n.actor_id in users_by_id:
                user = users_by_id[n.actor_id]
                profile = profiles_by_user_id.get(n.actor_id)
                avatar = media_by_id.get(profile.profile_picture_id) if profile and profile.profile_picture_id else None
                actor = {"id": user.id, "username": user.username, "avatar_url": avatar.url if avatar else None}

            post = posts_by_id.get(n.post_id) if n.post_id else None
            comment = comments_by_id.get(n.comment_id) if n.comment_id else None

            results.append({
                "id": n.id,
                "type": n.type.value if hasattr(n.type, "value") else n.type,
                "actor": actor,
                "post_id": n.post_id,
                "comment_id": n.comment_id,
                "post_preview": post.content[:80] if post else None,
                "comment_preview": comment.content[:80] if comment else None,
                "friend_request_id": n.friend_request_id,
                "is_read": n.is_read,
                "created_at": n.created_at,
            })
        return results