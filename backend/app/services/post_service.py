from sqlalchemy.orm import Session
from datetime import datetime, timezone, timedelta
import uuid

from app.models.post import Post
from app.models.user_profile import UserProfile
from app.schemas.post import PostCreate, PostUpdate
from app.db.enums import PostStatus
from app.core.exceptions import PostNotFoundException, NotPostOwnerException


class PostService:

    @staticmethod
    def create_post(db: Session, author_id: uuid.UUID, post_create: PostCreate) -> Post:
        post = Post(
            author_id=author_id,
            content=post_create.content,
        )
        db.add(post)

        # keep the denormalized post_count on user_profiles in sync, same transaction
        profile = db.query(UserProfile).filter(UserProfile.user_id == author_id).first()
        if profile:
            profile.post_count += 1
            db.add(profile)

        db.commit()
        db.refresh(post)
        return post

    @staticmethod
    def get_post_by_id(db: Session, post_id: uuid.UUID) -> Post:
        return db.query(Post).filter(Post.id == post_id, Post.deleted_at.is_(None)).first()

    @staticmethod
    def get_post_or_404(db: Session, post_id: uuid.UUID) -> Post:
        post = PostService.get_post_by_id(db, post_id)
        if not post:
            raise PostNotFoundException()
        return post

    @staticmethod
    def _get_owned_post_or_404(db: Session, post_id: uuid.UUID, user_id: uuid.UUID) -> Post:
        post = PostService.get_post_or_404(db, post_id)
        if post.author_id != user_id:
            raise NotPostOwnerException()
        return post

    @staticmethod
    def update_post(db: Session, post_id: uuid.UUID, user_id: uuid.UUID, post_update: PostUpdate) -> Post:
        post = PostService._get_owned_post_or_404(db, post_id, user_id)
        post.content = post_update.content
        db.add(post)
        db.commit()
        db.refresh(post)
        return post

    @staticmethod
    def delete_post(db: Session, post_id: uuid.UUID, user_id: uuid.UUID) -> None:
        post = PostService._get_owned_post_or_404(db, post_id, user_id)
        post.status = PostStatus.deleted
        post.deleted_at = datetime.now(timezone.utc)
        db.add(post)

        profile = db.query(UserProfile).filter(UserProfile.user_id == user_id).first()
        if profile and profile.post_count > 0:
            profile.post_count -= 1
            db.add(profile)

        db.commit()

    @staticmethod
    def list_posts(db: Session, skip: int = 0, limit: int = 20):
        return (
            db.query(Post)
            .filter(Post.status == PostStatus.active, Post.deleted_at.is_(None))
            .order_by(Post.created_at.desc())
            .offset(skip)
            .limit(limit)
            .all()
        )

    @staticmethod
    def archive_post(db: Session, post_id: uuid.UUID, user_id: uuid.UUID) -> Post:
        post = PostService._get_owned_post_or_404(db, post_id, user_id)
        post.status = PostStatus.archived
        db.add(post)
        db.commit()
        db.refresh(post)
        return post

    @staticmethod
    def unarchive_post(db: Session, post_id: uuid.UUID, user_id: uuid.UUID) -> Post:
        post = PostService._get_owned_post_or_404(db, post_id, user_id)
        post.status = PostStatus.active
        db.add(post)
        db.commit()
        db.refresh(post)
        return post

    @staticmethod
    def list_archived_posts(db: Session, user_id: uuid.UUID):
        return (
            db.query(Post)
            .filter(Post.author_id == user_id, Post.status == PostStatus.archived, Post.deleted_at.is_(None))
            .order_by(Post.created_at.desc())
            .all()
        )