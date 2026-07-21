from sqlalchemy.orm import Session
from datetime import datetime
from typing import Optional
from collections import defaultdict
import uuid

from app.models.post import Post
from app.models.user import User
from app.models.user_profile import UserProfile
from app.models.media import Media
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

    # ── Response shaping ──────────────────────────────────────────────
    # `to_response_dict` is a thin wrapper around the batched version so
    # every call site (single-post or list) goes through the same shaping
    # logic and stays consistent. Only `to_response_dict_batch` actually
    # talks to the database; use it directly whenever you have more than
    # one post, or you're back to the N+1 pattern this replaced.

    @staticmethod
    def to_response_dict(db: Session, post: Post, liked_post_ids: Optional[set] = None) -> dict:
        return PostService.to_response_dict_batch(db, [post], liked_post_ids)[0]

    @staticmethod
    def to_response_dict_batch(db: Session, posts: list, liked_post_ids: Optional[set] = None) -> list:
        """Builds response dicts for a list of posts using a fixed number
        of batched queries (author lookup, media lookup, original-post
        lookup, original-author lookup) instead of one round trip per
        post per relation. Every endpoint that returns one or many posts
        should go through here so author info, media, share attribution,
        and per-user like state stay consistent no matter which endpoint
        the posts came from."""
        if not posts:
            return []

        liked_post_ids = liked_post_ids or set()
        post_ids = [p.id for p in posts]

        # 1 query: authors of the posts themselves
        author_ids = {p.author_id for p in posts}
        authors_by_id = {
            u.id: u for u in db.query(User).filter(User.id.in_(author_ids)).all()
        }

        # 1 query: all media attached to any of these posts
        media_by_post_id = defaultdict(list)
        for m in db.query(Media).filter(Media.post_id.in_(post_ids)).all():
            media_by_post_id[m.post_id].append(m)

        # 1 query (+1 for their authors): shared/original posts
        original_ids = {p.original_post_id for p in posts if p.original_post_id}
        originals_by_id = {}
        original_authors_by_id = {}
        if original_ids:
            originals_by_id = {
                p.id: p for p in db.query(Post).filter(Post.id.in_(original_ids)).all()
            }
            original_author_ids = {p.author_id for p in originals_by_id.values()}
            original_authors_by_id = {
                u.id: u for u in db.query(User).filter(User.id.in_(original_author_ids)).all()
            }

        results = []
        for post in posts:
            author = authors_by_id.get(post.author_id)
            media_items = media_by_post_id.get(post.id, [])

            data = {
                "id": post.id,
                "author_id": post.author_id,
                "author_username": author.username if author else None,
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
                "media": [
                    {
                        "id": m.id,
                        "url": m.url,
                        "media_type": m.media_type.value if hasattr(m.media_type, "value") else m.media_type,
                    }
                    for m in media_items
                ],
                "liked_by_me": post.id in liked_post_ids,
            }

            if post.original_post_id:
                original = originals_by_id.get(post.original_post_id)
                if original:
                    data["original_content"] = original.content
                    original_author = original_authors_by_id.get(original.author_id)
                    if original_author:
                        data["original_author_username"] = original_author.username

            results.append(data)

        return results