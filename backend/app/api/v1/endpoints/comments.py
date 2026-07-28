from fastapi import APIRouter, Depends, status
from sqlalchemy.orm import Session
from typing import List
import uuid

from app.core.dependencies import get_db, get_current_user
from app.models.user import User
from app.schemas.comment import CommentCreate, CommentResponse
from app.services.comment_service import CommentService

router = APIRouter(tags=["comments"])


@router.post("/posts/{post_id}/comments", response_model=CommentResponse, status_code=status.HTTP_201_CREATED)
def create_comment(
    post_id: uuid.UUID,
    comment_create: CommentCreate,
    current_user: User = Depends(get_current_user),
    db: Session = Depends(get_db),
):
    comment = CommentService.create_comment(db, post_id, current_user.id, comment_create)
    return CommentService.to_response_dict(db, comment)


@router.get("/posts/{post_id}/comments", response_model=List[CommentResponse])
def list_comments(post_id: uuid.UUID, db: Session = Depends(get_db)):
    comments = CommentService.list_comments(db, post_id)
    return [CommentService.to_response_dict(db, c) for c in comments]


@router.delete("/comments/{comment_id}", status_code=status.HTTP_204_NO_CONTENT)
def delete_comment(
    comment_id: uuid.UUID,
    current_user: User = Depends(get_current_user),
    db: Session = Depends(get_db),
):
    CommentService.delete_comment(db, comment_id, current_user.id)