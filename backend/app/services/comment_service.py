from sqlalchemy.orm import Session
from datetime import datetime
import uuid

from app.models.comment import Comment
from app.models.user import User
from app.services.post_service import PostService
from app.core.exceptions import (
    CommentNotFoundException,
    NotCommentOwnerOrPostOwnerException,
    ParentCommentNotFoundException,
)
from app.schemas.comment import CommentCreate


class CommentService:

    @staticmethod
    def create_comment(db: Session, post_id: uuid.UUID, user_id: uuid.UUID, comment_create: CommentCreate) -> Comment:
        post = PostService.get_post_or_404(db, post_id)

        if comment_create.parent_comment_id:
            parent = (
                db.query(Comment)
                .filter(
                    Comment.id == comment_create.parent_comment_id,
                    Comment.post_id == post_id,  # parent must belong to the same post
                    Comment.deleted_at.is_(None),
                )
                .first()
            )
            if not parent:
                raise ParentCommentNotFoundException()

        comment = Comment(
            post_id=post_id,
            user_id=user_id,
            parent_comment_id=comment_create.parent_comment_id,
            content=comment_create.content,
        )
        db.add(comment)

        # comment_count includes replies, not just top-level comments
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

        if comment.user_id != user_id and post.author_id != user_id:
            raise NotCommentOwnerOrPostOwnerException()

        comment.deleted_at = datetime.utcnow()
        db.add(comment)

        post.comment_count = max(post.comment_count - 1, 0)
        db.add(post)

        db.commit()

    @staticmethod
    def to_response_dict(db: Session, comment: Comment) -> dict:
        author = db.query(User).filter(User.id == comment.user_id).first()
        return {
            "id": comment.id,
            "post_id": comment.post_id,
            "user_id": comment.user_id,
            "author_username": author.username if author else None,
            "parent_comment_id": comment.parent_comment_id,
            "content": comment.content,
            "like_count": comment.like_count,
            "created_at": comment.created_at,
            "updated_at": comment.updated_at,
        }