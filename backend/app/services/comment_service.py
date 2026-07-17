from sqlalchemy.orm import Session
from datetime import datetime
import uuid

from app.models.comment import Comment
from app.services.post_service import PostService
from app.core.exceptions import CommentNotFoundException, NotCommentOwnerOrPostOwnerException
from app.schemas.comment import CommentCreate


class CommentService:

    @staticmethod
    def create_comment(db: Session, post_id: uuid.UUID, user_id: uuid.UUID, comment_create: CommentCreate) -> Comment:
        post = PostService.get_post_or_404(db, post_id)

        comment = Comment(
            post_id=post_id,
            user_id=user_id,
            parent_comment_id=comment_create.parent_comment_id,
            content=comment_create.content,
        )
        db.add(comment)

        post.comment_count += 1
        db.add(post)

        db.commit()
        db.refresh(comment)
        return comment

    @staticmethod
    def list_comments(db: Session, post_id: uuid.UUID):
        PostService.get_post_or_404(db, post_id)
        return (
            db.query(Comment)
            .filter(Comment.post_id == post_id, Comment.deleted_at.is_(None))
            .order_by(Comment.created_at.asc())
            .all()
        )

    @staticmethod
    def delete_comment(db: Session, comment_id: uuid.UUID, user_id: uuid.UUID) -> None:
        comment = (
            db.query(Comment)
            .filter(Comment.id == comment_id, Comment.deleted_at.is_(None))
            .first()
        )
        if not comment:
            raise CommentNotFoundException()

        post = PostService.get_post_or_404(db, comment.post_id)

        # comment author OR the post's owner can moderate/delete a comment
        if comment.user_id != user_id and post.author_id != user_id:
            raise NotCommentOwnerOrPostOwnerException()

        comment.deleted_at = datetime.utcnow()
        db.add(comment)

        post.comment_count = max(post.comment_count - 1, 0)
        db.add(post)

        db.commit()