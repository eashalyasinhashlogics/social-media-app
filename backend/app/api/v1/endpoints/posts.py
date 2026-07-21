from fastapi import APIRouter, Depends, status
from sqlalchemy.orm import Session
from typing import List, Optional
import uuid

from app.core.dependencies import get_db, get_current_user, get_current_user_optional
from app.models.user import User
from app.schemas.post import PostCreate, PostUpdate, PostResponse, ShareCreate, LikeToggleResponse
from app.services.post_service import PostService
from app.services.like_service import LikeService

router = APIRouter(prefix="/posts", tags=["posts"])


@router.post("", response_model=PostResponse, status_code=status.HTTP_201_CREATED)
def create_post(
    post_create: PostCreate,
    current_user: User = Depends(get_current_user),
    db: Session = Depends(get_db),
):
    post = PostService.create_post(db, current_user.id, post_create)
    return PostService.to_response_dict(db, post)


@router.get("", response_model=List[PostResponse])
def list_posts(
    skip: int = 0,
    limit: int = 20,
    current_user: Optional[User] = Depends(get_current_user_optional),
    db: Session = Depends(get_db),
):
    posts = PostService.list_posts(db, skip, limit)
    # Batched: one query for authors, one for media, one (+1) for shares,
    # regardless of how many posts are on the page - fixes the feed N+1.
    liked_ids = (
        LikeService.get_liked_post_ids(db, current_user.id, [p.id for p in posts])
        if current_user else set()
    )
    return PostService.to_response_dict_batch(db, posts, liked_ids)


# NOTE: "/me/..." routes must stay registered BEFORE "/{post_id}" below,
# otherwise FastAPI tries to parse "me" as a post_id UUID and fails with 422.

@router.get("/me/archived", response_model=List[PostResponse])
def list_my_archived_posts(
    current_user: User = Depends(get_current_user),
    db: Session = Depends(get_db),
):
    posts = PostService.list_archived_posts(db, current_user.id)
    liked_ids = LikeService.get_liked_post_ids(db, current_user.id, [p.id for p in posts])
    return PostService.to_response_dict_batch(db, posts, liked_ids)


@router.get("/me/liked-ids", response_model=List[uuid.UUID])
def list_my_liked_post_ids(
    current_user: User = Depends(get_current_user),
    db: Session = Depends(get_db),
):
    posts = PostService.list_posts(db, skip=0, limit=1000)
    liked_ids = LikeService.get_liked_post_ids(db, current_user.id, [p.id for p in posts])
    return list(liked_ids)


@router.get("/{post_id}", response_model=PostResponse)
def get_post(post_id: uuid.UUID, db: Session = Depends(get_db)):
    post = PostService.get_post_or_404(db, post_id)
    return PostService.to_response_dict(db, post)


@router.patch("/{post_id}", response_model=PostResponse)
def update_post(
    post_id: uuid.UUID,
    post_update: PostUpdate,
    current_user: User = Depends(get_current_user),
    db: Session = Depends(get_db),
):
    post = PostService.update_post(db, post_id, current_user.id, post_update)
    return PostService.to_response_dict(db, post)


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
    post = PostService.archive_post(db, post_id, current_user.id)
    return PostService.to_response_dict(db, post)


@router.patch("/{post_id}/unarchive", response_model=PostResponse)
def unarchive_post(
    post_id: uuid.UUID,
    current_user: User = Depends(get_current_user),
    db: Session = Depends(get_db),
):
    post = PostService.unarchive_post(db, post_id, current_user.id)
    return PostService.to_response_dict(db, post)


@router.post("/{post_id}/like", response_model=LikeToggleResponse)
def toggle_like(
    post_id: uuid.UUID,
    current_user: User = Depends(get_current_user),
    db: Session = Depends(get_db),
):
    return LikeService.toggle_like(db, post_id, current_user.id)


@router.post("/{post_id}/share", response_model=PostResponse, status_code=status.HTTP_201_CREATED)
def share_post(
    post_id: uuid.UUID,
    share_create: ShareCreate,
    current_user: User = Depends(get_current_user),
    db: Session = Depends(get_db),
):
    share = PostService.share_post(db, post_id, current_user.id, share_create)
    return PostService.to_response_dict(db, share)