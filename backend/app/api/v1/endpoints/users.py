from fastapi import APIRouter, Depends, HTTPException, status
from sqlalchemy.orm import Session
from typing import Optional
import uuid

from app.core.dependencies import get_db, get_current_user, get_current_user_optional
from app.models.user import User
from app.schemas.user import UserResponse
from app.schemas.user_profile import ProfileResponse, ProfileUpdate
from app.services.user_service import UserService
from app.services.profile_service import ProfileService
from app.schemas.follow import FollowResponse, FollowerUser
from app.services.follow_service import FollowService
from typing import List

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
    # Powers the Edit Profile modal - username, display name, and bio
    # can all be updated in a single request (any omitted field is
    # left untouched).
    ProfileService.update_profile(
        db,
        current_user.id,
        username=profile_update.username,
        display_name=profile_update.display_name,
        bio=profile_update.bio,
    )
    return ProfileService.get_own_profile(db, current_user.id)


@router.get("/{user_id}", response_model=UserResponse)
def get_user(user_id: str, db: Session = Depends(get_db)):
    user = UserService.get_user_by_id(db, user_id)
    if not user:
        raise HTTPException(status_code=status.HTTP_404_NOT_FOUND, detail="User not found")
    return user


@router.get("/{user_id}/profile", response_model=ProfileResponse)
def get_public_profile(
    user_id: uuid.UUID,
    current_user: Optional[User] = Depends(get_current_user_optional),
    db: Session = Depends(get_db),
):
    # current_user is optional - anyone can view a public profile, but if
    # the visitor happens to be logged in we still want their own
    # liked_by_me state on each post, not a blanket False.
    viewer_id = current_user.id if current_user else None
    return ProfileService.get_public_profile(db, user_id, viewer_id)



@router.post("/{user_id}/follow", response_model=FollowResponse, status_code=status.HTTP_201_CREATED)
def follow_user(
    user_id: uuid.UUID,
    current_user: User = Depends(get_current_user),
    db: Session = Depends(get_db),
):
    return FollowService.follow(db, current_user.id, user_id)


@router.delete("/{user_id}/follow", response_model=FollowResponse)
def unfollow_user(
    user_id: uuid.UUID,
    current_user: User = Depends(get_current_user),
    db: Session = Depends(get_db),
):
    return FollowService.unfollow(db, current_user.id, user_id)


@router.get("/{user_id}/followers", response_model=List[FollowerUser])
def list_followers(user_id: uuid.UUID, db: Session = Depends(get_db)):
    return FollowService.list_followers(db, user_id)


@router.get("/{user_id}/following", response_model=List[FollowerUser])
def list_following(user_id: uuid.UUID, db: Session = Depends(get_db)):
    return FollowService.list_following(db, user_id)