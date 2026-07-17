from fastapi import APIRouter, Depends, HTTPException, status
from sqlalchemy.orm import Session
import uuid

from app.core.dependencies import get_db, get_current_user
from app.models.user import User
from app.schemas.user import UserResponse
from app.schemas.user_profile import ProfileResponse, ProfileUpdate
from app.services.user_service import UserService
from app.services.profile_service import ProfileService

router = APIRouter(prefix="/users", tags=["users"])


@router.get("/me", response_model=UserResponse)
def get_current_user_profile(current_user: User = Depends(get_current_user)):
    return current_user


# NOTE: registered BEFORE "/{user_id}" so FastAPI doesn't try to parse "me" as a UUID.
@router.get("/me/profile", response_model=ProfileResponse)
def get_own_profile(
    current_user: User = Depends(get_current_user),
    db: Session = Depends(get_db),
):
    return ProfileService.get_own_profile(db, current_user.id)


@router.patch("/me/profile", response_model=ProfileResponse)
def update_own_profile(
    profile_update: ProfileUpdate,
    current_user: User = Depends(get_current_user),
    db: Session = Depends(get_db),
):
    ProfileService.update_bio(db, current_user.id, profile_update.bio)
    return ProfileService.get_own_profile(db, current_user.id)


@router.get("/{user_id}", response_model=UserResponse)
def get_user(user_id: str, db: Session = Depends(get_db)):
    user = UserService.get_user_by_id(db, user_id)
    if not user:
        raise HTTPException(status_code=status.HTTP_404_NOT_FOUND, detail="User not found")
    return user


@router.get("/{user_id}/profile", response_model=ProfileResponse)
def get_public_profile(user_id: uuid.UUID, db: Session = Depends(get_db)):
    return ProfileService.get_public_profile(db, user_id)