from sqlalchemy.orm import Session
import uuid

from app.models.post_like import PostLike
from app.services.post_service import PostService


class LikeService:

    @staticmethod
    def toggle_like(db: Session, post_id: uuid.UUID, user_id: uuid.UUID) -> dict:
        post = PostService.get_post_or_404(db, post_id)

        existing = (
            db.query(PostLike)
            .filter(PostLike.post_id == post_id, PostLike.user_id == user_id)
            .first()
        )

        if existing:
            db.delete(existing)
            post.like_count = max(post.like_count - 1, 0)
            liked = False
        else:
            db.add(PostLike(post_id=post_id, user_id=user_id))
            post.like_count += 1
            liked = True

        db.add(post)
        db.commit()
        db.refresh(post)

        return {"liked": liked, "like_count": post.like_count}
        
    @staticmethod
    def get_liked_post_ids(db: Session, user_id: uuid.UUID, post_ids: list) -> set:
        if not post_ids:
            return set()
        rows = (
            db.query(PostLike.post_id)
            .filter(PostLike.user_id == user_id, PostLike.post_id.in_(post_ids))
            .all()
        )
        return {row[0] for row in rows}