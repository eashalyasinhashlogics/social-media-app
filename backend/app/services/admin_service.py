import uuid
from datetime import datetime, timedelta
from typing import Optional, List, Tuple

from sqlalchemy import cast, Date, func
from sqlalchemy.orm import Session

from app.models.user import User
from app.models.post import Post
from app.models.post_like import PostLike
from app.models.comment import Comment
from app.models.refresh_token import RefreshToken
from app.db.enums import UserRole, UserStatus, PostStatus
from app.core.exceptions import UserNotFoundException
from app.schemas.admin import AdminUserUpdate


class AdminService:

    @staticmethod
    def list_users(
        db: Session,
        skip: int = 0,
        limit: int = 20,
        status_filter: Optional[UserStatus] = None,
        role_filter: Optional[UserRole] = None,
    ) -> Tuple[int, List[User]]:
        query = db.query(User)
        if status_filter is not None:
            query = query.filter(User.status == status_filter)
        if role_filter is not None:
            query = query.filter(User.role == role_filter)
        total = query.count()
        users = query.order_by(User.created_at.desc()).offset(skip).limit(limit).all()
        return total, users

    @staticmethod
    def get_user_or_404(db: Session, user_id: uuid.UUID) -> User:
        user = db.query(User).filter(User.id == user_id).first()
        if not user:
            raise UserNotFoundException()
        return user

    @staticmethod
    def update_user(db: Session, user_id: uuid.UUID, payload: AdminUserUpdate) -> User:
        user = AdminService.get_user_or_404(db, user_id)
        if payload.username is not None:
            user.username = payload.username
        if payload.role is not None:
            user.role = payload.role
        db.add(user)
        db.commit()
        db.refresh(user)
        return user

    @staticmethod
    def _revoke_all_sessions(db: Session, user_id: uuid.UUID) -> None:
        db.query(RefreshToken).filter(
            RefreshToken.user_id == user_id,
            RefreshToken.revoked == False,
        ).update({"revoked": True}, synchronize_session=False)

    @staticmethod
    def block_user(db: Session, user_id: uuid.UUID) -> User:
        user = AdminService.get_user_or_404(db, user_id)
        user.status = UserStatus.blocked
        db.add(user)
        AdminService._revoke_all_sessions(db, user_id)
        db.commit()
        db.refresh(user)
        return user

    @staticmethod
    def unblock_user(db: Session, user_id: uuid.UUID) -> User:
        user = AdminService.get_user_or_404(db, user_id)
        user.status = UserStatus.active
        db.add(user)
        db.commit()
        db.refresh(user)
        return user

    @staticmethod
    def soft_delete_user(db: Session, user_id: uuid.UUID) -> User:
        user = AdminService.get_user_or_404(db, user_id)
        user.status = UserStatus.deleted
        user.deleted_at = datetime.utcnow()
        db.add(user)
        AdminService._revoke_all_sessions(db, user_id)
        db.commit()
        db.refresh(user)
        return user

    # ── Stats dashboard (Slice 6) ─────────────────────────────────────

    @staticmethod
    def _count_by_day(db: Session, ts_column, cutoff: datetime, extra_filters: Optional[list] = None) -> List[dict]:
        day_col = cast(ts_column, Date)
        query = db.query(day_col.label("day"), func.count().label("count")).filter(ts_column >= cutoff)
        for condition in (extra_filters or []):
            query = query.filter(condition)
        rows = query.group_by(day_col).order_by(day_col).all()
        return [{"date": str(day), "count": count} for day, count in rows]

    @staticmethod
    def get_stats(db: Session, days: int = 30) -> dict:
        cutoff = datetime.utcnow() - timedelta(days=days)

        total_users = db.query(User).filter(User.deleted_at.is_(None)).count()
        total_posts = db.query(Post).filter(Post.deleted_at.is_(None)).count()
        active_posts = db.query(Post).filter(
            Post.status == PostStatus.active, Post.deleted_at.is_(None)
        ).count()
        archived_posts = db.query(Post).filter(
            Post.status == PostStatus.archived, Post.deleted_at.is_(None)
        ).count()

        signups_by_day = AdminService._count_by_day(
            db, User.created_at, cutoff, extra_filters=[User.deleted_at.is_(None)]
        )
        likes_by_day = AdminService._count_by_day(db, PostLike.created_at, cutoff)
        comments_by_day = AdminService._count_by_day(
            db, Comment.created_at, cutoff, extra_filters=[Comment.deleted_at.is_(None)]
        )

        return {
            "total_users": total_users,
            "total_posts": total_posts,
            "active_posts": active_posts,
            "archived_posts": archived_posts,
            "signups_by_day": signups_by_day,
            "likes_by_day": likes_by_day,
            "comments_by_day": comments_by_day,
        }
