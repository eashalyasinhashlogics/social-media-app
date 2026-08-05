from fastapi import APIRouter, Depends, Query, status
from sqlalchemy.orm import Session
from typing import List, Literal
import uuid

from app.core.dependencies import get_db, get_current_user
from app.models.user import User
from app.schemas.friend import FriendRequestCreate, FriendRequestResponse, FriendshipResponse
from app.services.friend_service import FriendService

friend_requests_router = APIRouter(prefix="/friend-requests", tags=["friends"])
friends_router = APIRouter(prefix="/friends", tags=["friends"])


@friend_requests_router.post("", response_model=FriendRequestResponse, status_code=status.HTTP_201_CREATED)
def send_friend_request(
    payload: FriendRequestCreate,
    current_user: User = Depends(get_current_user),
    db: Session = Depends(get_db),
):
    return FriendService.send_request(db, current_user.id, payload.to_user_id)


@friend_requests_router.get("", response_model=List[FriendRequestResponse])
def list_friend_requests(
    direction: Literal["incoming", "outgoing"] = Query("incoming"),
    current_user: User = Depends(get_current_user),
    db: Session = Depends(get_db),
):
    if direction == "outgoing":
        return FriendService.list_outgoing(db, current_user.id)
    return FriendService.list_incoming(db, current_user.id)


@friend_requests_router.post("/{request_id}/accept", response_model=FriendRequestResponse)
def accept_friend_request(
    request_id: uuid.UUID,
    current_user: User = Depends(get_current_user),
    db: Session = Depends(get_db),
):
    return FriendService.accept_request(db, request_id, current_user.id)


@friend_requests_router.post("/{request_id}/reject", response_model=FriendRequestResponse)
def reject_friend_request(
    request_id: uuid.UUID,
    current_user: User = Depends(get_current_user),
    db: Session = Depends(get_db),
):
    return FriendService.reject_request(db, request_id, current_user.id)


@friend_requests_router.delete("/{request_id}", status_code=status.HTTP_204_NO_CONTENT)
def cancel_friend_request(
    request_id: uuid.UUID,
    current_user: User = Depends(get_current_user),
    db: Session = Depends(get_db),
):
    FriendService.cancel_request(db, request_id, current_user.id)


@friends_router.get("", response_model=List[FriendshipResponse])
def list_friends(
    current_user: User = Depends(get_current_user),
    db: Session = Depends(get_db),
):
    return FriendService.list_friends(db, current_user.id)


@friends_router.delete("/{user_id}", status_code=status.HTTP_204_NO_CONTENT)
def unfriend(
    user_id: uuid.UUID,
    current_user: User = Depends(get_current_user),
    db: Session = Depends(get_db),
):
    FriendService.unfriend(db, current_user.id, user_id)