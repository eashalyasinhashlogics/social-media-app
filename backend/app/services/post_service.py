from sqlalchemy.orm import Session
from datetime import datetime
from typing import Optional
import uuid

from app.models.post import Post
from app.models.user import User
from app.models.user_profile import UserProfile
from app.schemas.post import PostCreate, PostUpdate
from app.db.enums import PostStatus
from app.core.exceptions import PostNotFoundException, NotPostOwnerException


class PostService:

    @staticmethod
    def create_post(db: Session, author_id: uuid.UUID, post_create: PostCreate) -> Post:
        post = Post(author_id=author_id, content=post_create.content)
        db.add(post)

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
        post.deleted_at = datetime.utcnow()
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

    @staticmethod
    def share_post(db: Session, original_post_id: uuid.UUID, user_id: uuid.UUID, share_create) -> Post:
        original = PostService.get_post_or_404(db, original_post_id)

        share = Post(
            author_id=user_id,
            content=share_create.caption or "",
            original_post_id=original.id,
        )
        db.add(share)

        original.share_count += 1
        db.add(original)

        profile = db.query(UserProfile).filter(UserProfile.user_id == user_id).first()
        if profile:
            profile.post_count += 1
            db.add(profile)

        db.commit()
        db.refresh(share)
        return share

    @staticmethod
    def to_response_dict(db: Session, post: Post) -> dict:
        """Every endpoint that returns a Post goes through this, so shared
        posts always carry attribution to the original author/content."""
        data = {
            "id": post.id,
            "author_id": post.author_id,
            "content": post.content,
            "status": post.status.value if hasattr(post.status, "value") else post.status,
            "like_count": post.like_count,
            "comment_count": post.comment_count,
            "share_count": post.share_count,
            "created_at": post.created_at,
            "updated_at": post.updated_at,
            "original_post_id": post.original_post_id,
            "original_author_username": None,
            "original_content": None,
        }

        if post.original_post_id:
            original = db.query(Post).filter(Post.id == post.original_post_id).first()
            if original:
                data["original_content"] = original.content
                author = db.query(User).filter(User.id == original.author_id).first()
                if author:
                    data["original_author_username"] = author.username
            # if original is None here, the source post was deleted and
            # original_post_id was nulled by the FK's ON DELETE SET NULL —
            # the share still displays fine, just with no attribution fields.

        return data