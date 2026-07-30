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
from app.core.exceptions import PostNotFoundException, NotPostOwnerException, ArchivedPostShareException


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

        if original.status == PostStatus.archived:
            raise ArchivedPostShareException()

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

    @staticmethod
    def to_response_dict(db: Session, post: Post, liked_post_ids: Optional[set] = None) -> dict:
        return PostService.to_response_dict_batch(db, [post], liked_post_ids)[0]

    @staticmethod
    def to_response_dict_batch(db: Session, posts: list, liked_post_ids: Optional[set] = None) -> list:
        if not posts:
            return []

        liked_post_ids = liked_post_ids or set()
        post_ids = [p.id for p in posts]

        author_ids = {p.author_id for p in posts}
        authors_by_id = {
            u.id: u for u in db.query(User).filter(User.id.in_(author_ids)).all()
        }

        profiles_by_user_id = {
            p.user_id: p
            for p in db.query(UserProfile).filter(UserProfile.user_id.in_(author_ids)).all()
        }
        avatar_media_ids = {
            p.profile_picture_id for p in profiles_by_user_id.values() if p.profile_picture_id
        }
        avatar_url_by_media_id = {}
        if avatar_media_ids:
            avatar_url_by_media_id = {
                m.id: m.url
                for m in db.query(Media).filter(Media.id.in_(avatar_media_ids)).all()
            }

        def _avatar_url_for(user_id) -> Optional[str]:
            profile = profiles_by_user_id.get(user_id)
            if not profile or not profile.profile_picture_id:
                return None
            return avatar_url_by_media_id.get(profile.profile_picture_id)

        media_by_post_id = defaultdict(list)
        for m in db.query(Media).filter(Media.post_id.in_(post_ids)).all():
            media_by_post_id[m.post_id].append(m)

        original_ids = {p.original_post_id for p in posts if p.original_post_id}
        originals_by_id = {}
        original_authors_by_id = {}
        if original_ids:
            originals_by_id = {
                p.id: p
                for p in db.query(Post)
                .filter(Post.id.in_(original_ids), Post.status == PostStatus.active)
                .all()
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
                "author_avatar_url": _avatar_url_for(post.author_id),
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

    @staticmethod
    def trending_hashtags(db: Session, limit: int = 5) -> list:
        import re
        from collections import Counter

        rows = (
            db.query(Post.content)
            .filter(Post.status == PostStatus.active)
            .order_by(Post.created_at.desc())
            .limit(500)
            .all()
        )
        counts: Counter = Counter()
        for (content,) in rows:
            for tag in re.findall(r"#(\w+)", content or ""):
                counts[tag.lower()] += 1
        return [{"tag": tag, "post_count": count} for tag, count in counts.most_common(limit)]

    @staticmethod
    def get_feed(db: Session, viewer_id: uuid.UUID, following_ids: list, skip: int = 0, limit: int = 20):
        if not following_ids:
            return []
        return (
            db.query(Post)
            .filter(
                Post.author_id.in_(following_ids),
                Post.status == PostStatus.active,
                Post.deleted_at.is_(None),
            )
            .order_by(Post.created_at.desc())
            .offset(skip)
            .limit(limit)
            .all()
        )

    # ── Admin operations (Slice 5) ────────────────────────────────────
    # These bypass the ownership check in _get_owned_post_or_404 on
    # purpose - only reachable via routes gated by get_current_admin.
    # The regular /api/v1/posts/{id} route and its ownership check are
    # untouched.

    @staticmethod
    def admin_get_post_or_404(db: Session, post_id: uuid.UUID) -> Post:
        """Unlike get_post_or_404, this doesn't filter out soft-deleted
        posts - admins need to be able to see what was deleted."""
        post = db.query(Post).filter(Post.id == post_id).first()
        if not post:
            raise PostNotFoundException()
        return post

    @staticmethod
    def admin_list_posts(
        db: Session,
        skip: int = 0,
        limit: int = 20,
        status_filter: Optional[PostStatus] = None,
        author_id: Optional[uuid.UUID] = None,
    ):
        query = db.query(Post)
        if status_filter is not None:
            query = query.filter(Post.status == status_filter)
        if author_id is not None:
            query = query.filter(Post.author_id == author_id)
        total = query.count()
        posts = query.order_by(Post.created_at.desc()).offset(skip).limit(limit).all()
        return total, posts

    @staticmethod
    def admin_update_post(db: Session, post_id: uuid.UUID, post_update: PostUpdate) -> Post:
        post = PostService.admin_get_post_or_404(db, post_id)
        post.content = post_update.content
        db.add(post)
        db.commit()
        db.refresh(post)
        return post

    @staticmethod
    def admin_delete_post(db: Session, post_id: uuid.UUID) -> Post:
        post = PostService.admin_get_post_or_404(db, post_id)
        if post.status != PostStatus.deleted:
            post.status = PostStatus.deleted
            post.deleted_at = datetime.utcnow()
            db.add(post)

            profile = db.query(UserProfile).filter(UserProfile.user_id == post.author_id).first()
            if profile and profile.post_count > 0:
                profile.post_count -= 1
                db.add(profile)

            db.commit()
        db.refresh(post)
        return post
