import uuid
from typing import Optional

from fastapi import APIRouter, Depends, Query
from sqlalchemy.orm import Session

from app.core.dependencies import get_db, get_current_admin
from app.models.user import User
from app.db.enums import UserRole, UserStatus, PostStatus
from app.schemas.admin import (
    AdminUserResponse,
    AdminUserListResponse,
    AdminUserUpdate,
    AdminPostListResponse,
    AdminStatsResponse,
)
from app.schemas.post import PostUpdate, PostResponse
from app.services.admin_service import AdminService
from app.services.post_service import PostService

router = APIRouter(prefix="/admin", tags=["admin"])


@router.get("/ping")
def admin_ping(current_admin: User = Depends(get_current_admin)):
    return {"message": f"Hello admin {current_admin.username}"}


@router.get("/users", response_model=AdminUserListResponse)
def list_users(
    skip: int = Query(0, ge=0),
    limit: int = Query(20, ge=1, le=100),
    status_filter: Optional[UserStatus] = Query(None, alias="status"),
    role_filter: Optional[UserRole] = Query(None, alias="role"),
    current_admin: User = Depends(get_current_admin),
    db: Session = Depends(get_db),
):
    total, users = AdminService.list_users(db, skip, limit, status_filter, role_filter)
    return AdminUserListResponse(total=total, items=users)


@router.get("/users/{user_id}", response_model=AdminUserResponse)
def get_user(
    user_id: uuid.UUID,
    current_admin: User = Depends(get_current_admin),
    db: Session = Depends(get_db),
):
    return AdminService.get_user_or_404(db, user_id)


@router.patch("/users/{user_id}", response_model=AdminUserResponse)
def update_user(
    user_id: uuid.UUID,
    payload: AdminUserUpdate,
    current_admin: User = Depends(get_current_admin),
    db: Session = Depends(get_db),
):
    return AdminService.update_user(db, user_id, payload)


@router.delete("/users/{user_id}", response_model=AdminUserResponse)
def delete_user(
    user_id: uuid.UUID,
    current_admin: User = Depends(get_current_admin),
    db: Session = Depends(get_db),
):
    return AdminService.soft_delete_user(db, user_id)


@router.post("/users/{user_id}/block", response_model=AdminUserResponse)
def block_user(
    user_id: uuid.UUID,
    current_admin: User = Depends(get_current_admin),
    db: Session = Depends(get_db),
):
    return AdminService.block_user(db, user_id)


@router.post("/users/{user_id}/unblock", response_model=AdminUserResponse)
def unblock_user(
    user_id: uuid.UUID,
    current_admin: User = Depends(get_current_admin),
    db: Session = Depends(get_db),
):
    return AdminService.unblock_user(db, user_id)


@router.get("/posts", response_model=AdminPostListResponse)
def list_all_posts(
    skip: int = Query(0, ge=0),
    limit: int = Query(20, ge=1, le=100),
    status_filter: Optional[PostStatus] = Query(None, alias="status"),
    author_id: Optional[uuid.UUID] = Query(None),
    current_admin: User = Depends(get_current_admin),
    db: Session = Depends(get_db),
):
    total, posts = PostService.admin_list_posts(db, skip, limit, status_filter, author_id)
    return AdminPostListResponse(total=total, items=PostService.to_response_dict_batch(db, posts))


@router.patch("/posts/{post_id}", response_model=PostResponse)
def admin_update_post(
    post_id: uuid.UUID,
    payload: PostUpdate,
    current_admin: User = Depends(get_current_admin),
    db: Session = Depends(get_db),
):
    post = PostService.admin_update_post(db, post_id, payload)
    return PostService.to_response_dict(db, post)


@router.delete("/posts/{post_id}", response_model=PostResponse)
def admin_delete_post(
    post_id: uuid.UUID,
    current_admin: User = Depends(get_current_admin),
    db: Session = Depends(get_db),
):
    post = PostService.admin_delete_post(db, post_id)
    return PostService.to_response_dict(db, post)


@router.get("/stats", response_model=AdminStatsResponse)
def get_stats(
    days: int = Query(30, ge=1, le=365),
    current_admin: User = Depends(get_current_admin),
    db: Session = Depends(get_db),
):
    return AdminService.get_stats(db, days)
