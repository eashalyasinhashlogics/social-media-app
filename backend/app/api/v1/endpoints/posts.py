from fastapi import APIRouter, Depends, status
from sqlalchemy.orm import Session
from typing import List
import uuid

from app.core.dependencies import get_db, get_current_user
from app.models.user import User
from app.schemas.post import PostCreate, PostUpdate, PostResponse
from app.services.post_service import PostService

router = APIRouter(prefix="/posts", tags=["posts"])


@router.post("", response_model=PostResponse, status_code=status.HTTP_201_CREATED)
def create_post(
    post_create: PostCreate,
    current_user: User = Depends(get_current_user),
    db: Session = Depends(get_db),
):
    return PostService.create_post(db, current_user.id, post_create)


@router.get("", response_model=List[PostResponse])
def list_posts(skip: int = 0, limit: int = 20, db: Session = Depends(get_db)):
    return PostService.list_posts(db, skip, limit)


# NOTE: this must stay registered BEFORE "/{post_id}" below, otherwise FastAPI
# will try to parse "me" as a post_id UUID and fail with a 422 instead of
# matching this route.
@router.get("/me/archived", response_model=List[PostResponse])
def list_my_archived_posts(
    current_user: User = Depends(get_current_user),
    db: Session = Depends(get_db),
):
    return PostService.list_archived_posts(db, current_user.id)


@router.get("/{post_id}", response_model=PostResponse)
def get_post(post_id: uuid.UUID, db: Session = Depends(get_db)):
    return PostService.get_post_or_404(db, post_id)


@router.patch("/{post_id}", response_model=PostResponse)
def update_post(
    post_id: uuid.UUID,
    post_update: PostUpdate,
    current_user: User = Depends(get_current_user),
    db: Session = Depends(get_db),
):
    return PostService.update_post(db, post_id, current_user.id, post_update)


@router.delete("/{post_id}", status_code=status.HTTP_204_NO_CONTENT)
def delete_post(
    post_id: uuid.UUID,
    current_user: User = Depends(get_current_user),
    db: Session = Depends(get_db),
):
    PostService.delete_post(db, post_id, current_user.id)


@router.patch("/{post_id}/archive", response_model=PostResponse)
def archive_post(
    post_id: uuid.UUID,
    current_user: User = Depends(get_current_user),
    db: Session = Depends(get_db),
):
    return PostService.archive_post(db, post_id, current_user.id)


@router.patch("/{post_id}/unarchive", response_model=PostResponse)
def unarchive_post(
    post_id: uuid.UUID,
    current_user: User = Depends(get_current_user),
    db: Session = Depends(get_db),
):
    return PostService.unarchive_post(db, post_id, current_user.id)