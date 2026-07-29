from sqlalchemy.orm import Session
from sqlalchemy import or_, and_
from fastapi import HTTPException, status
from typing import List
import uuid
from app.services.notification_service import NotificationService
from app.models.friend_request import FriendRequest
from app.models.friendship import Friendship
from app.models.user import User
from app.db.enums import FriendRequestStatus
from app.core.exceptions import UserNotFoundException


class CannotFriendRequestSelfException(HTTPException):
    def __init__(self):
        super().__init__(status_code=status.HTTP_400_BAD_REQUEST, detail="You cannot send a friend request to yourself")


class FriendRequestAlreadyExistsException(HTTPException):
    def __init__(self):
        super().__init__(status_code=status.HTTP_409_CONFLICT, detail="A pending friend request already exists between you two")


class AlreadyFriendsException(HTTPException):
    def __init__(self):
        super().__init__(status_code=status.HTTP_409_CONFLICT, detail="You are already friends with this user")


class FriendRequestNotFoundException(HTTPException):
    def __init__(self):
        super().__init__(status_code=status.HTTP_404_NOT_FOUND, detail="Friend request not found")


class NotFriendRequestRecipientException(HTTPException):
    def __init__(self):
        super().__init__(status_code=status.HTTP_403_FORBIDDEN, detail="Only the recipient can respond to this friend request")


class NotFriendRequestSenderException(HTTPException):
    def __init__(self):
        super().__init__(status_code=status.HTTP_403_FORBIDDEN, detail="Only the sender can cancel this friend request")


class FriendRequestNotPendingException(HTTPException):
    def __init__(self):
        super().__init__(status_code=status.HTTP_400_BAD_REQUEST, detail="This friend request has already been resolved")


class NotFriendsException(HTTPException):
    def __init__(self):
        super().__init__(status_code=status.HTTP_404_NOT_FOUND, detail="You are not friends with this user")


class FriendService:

    @staticmethod
    def _get_active_user_or_404(db: Session, user_id: uuid.UUID) -> User:
        user = db.query(User).filter(User.id == user_id, User.deleted_at.is_(None)).first()
        if not user:
            raise UserNotFoundException()
        return user

    @staticmethod
    def _ordered_pair(user_a: uuid.UUID, user_b: uuid.UUID):
        """Always returns (smaller_uuid, larger_uuid) so a friendship row
        is unique per pair regardless of who befriended whom. Matches the
        ck_friendships_ordered_pair check constraint on the table."""
        return (user_a, user_b) if user_a < user_b else (user_b, user_a)

    @staticmethod
    def _get_friendship(db: Session, user_a: uuid.UUID, user_b: uuid.UUID):
        user1_id, user2_id = FriendService._ordered_pair(user_a, user_b)
        return (
            db.query(Friendship)
            .filter(Friendship.user1_id == user1_id, Friendship.user2_id == user2_id)
            .first()
        )

    @staticmethod
    def are_friends(db: Session, user_a: uuid.UUID, user_b: uuid.UUID) -> bool:
        return FriendService._get_friendship(db, user_a, user_b) is not None

    # ── Friend requests ─────────────────────────────────────────────

    @staticmethod
    def send_request(db: Session, from_user_id: uuid.UUID, to_user_id: uuid.UUID) -> FriendRequest:
        if from_user_id == to_user_id:
            raise CannotFriendRequestSelfException()

        FriendService._get_active_user_or_404(db, to_user_id)

        if FriendService.are_friends(db, from_user_id, to_user_id):
            raise AlreadyFriendsException()

        # A pending request in *either* direction blocks a new one - if B
        # already asked A, A should accept/reject that one, not spawn a
        # second parallel request.
        existing = (
            db.query(FriendRequest)
            .filter(
                FriendRequest.status == FriendRequestStatus.pending,
                or_(
                    and_(FriendRequest.from_user_id == from_user_id, FriendRequest.to_user_id == to_user_id),
                    and_(FriendRequest.from_user_id == to_user_id, FriendRequest.to_user_id == from_user_id),
                ),
            )
            .first()
        )
        if existing:
            raise FriendRequestAlreadyExistsException()

        request = FriendRequest(from_user_id=from_user_id, to_user_id=to_user_id, status=FriendRequestStatus.pending)
        db.add(request)
        db.commit()
        db.refresh(request)
        NotificationService.notify_friend_request(db, to_user_id, from_user_id, request.id)

        return request

    @staticmethod
    def _get_request_or_404(db: Session, request_id: uuid.UUID) -> FriendRequest:
        request = db.query(FriendRequest).filter(FriendRequest.id == request_id).first()
        if not request:
            raise FriendRequestNotFoundException()
        return request

    @staticmethod
    def accept_request(db: Session, request_id: uuid.UUID, current_user_id: uuid.UUID) -> FriendRequest:
        request = FriendService._get_request_or_404(db, request_id)
        if request.to_user_id != current_user_id:
            raise NotFriendRequestRecipientException()
        if request.status != FriendRequestStatus.pending:
            raise FriendRequestNotPendingException()

        request.status = FriendRequestStatus.accepted
        db.add(request)

        user1_id, user2_id = FriendService._ordered_pair(request.from_user_id, request.to_user_id)
        db.add(Friendship(user1_id=user1_id, user2_id=user2_id))

        db.commit()
        db.refresh(request)
        NotificationService.notify_friend_request(db, to_user_id, from_user_id, request.id)
        return request

    @staticmethod
    def reject_request(db: Session, request_id: uuid.UUID, current_user_id: uuid.UUID) -> FriendRequest:
        request = FriendService._get_request_or_404(db, request_id)
        if request.to_user_id != current_user_id:
            raise NotFriendRequestRecipientException()
        if request.status != FriendRequestStatus.pending:
            raise FriendRequestNotPendingException()

        request.status = FriendRequestStatus.rejected
        db.add(request)
        db.commit()
        db.refresh(request)
        return request

    @staticmethod
    def cancel_request(db: Session, request_id: uuid.UUID, current_user_id: uuid.UUID) -> None:
        request = FriendService._get_request_or_404(db, request_id)
        if request.from_user_id != current_user_id:
            raise NotFriendRequestSenderException()
        if request.status != FriendRequestStatus.pending:
            raise FriendRequestNotPendingException()

        db.delete(request)
        db.commit()

    @staticmethod
    def list_incoming(db: Session, user_id: uuid.UUID) -> List[FriendRequest]:
        return (
            db.query(FriendRequest)
            .filter(FriendRequest.to_user_id == user_id, FriendRequest.status == FriendRequestStatus.pending)
            .order_by(FriendRequest.created_at.desc())
            .all()
        )

    @staticmethod
    def list_outgoing(db: Session, user_id: uuid.UUID) -> List[FriendRequest]:
        return (
            db.query(FriendRequest)
            .filter(FriendRequest.from_user_id == user_id, FriendRequest.status == FriendRequestStatus.pending)
            .order_by(FriendRequest.created_at.desc())
            .all()
        )

    # ── Friendships ─────────────────────────────────────────────────

    @staticmethod
    def list_friends(db: Session, user_id: uuid.UUID) -> list:
        rows = (
            db.query(Friendship)
            .filter(or_(Friendship.user1_id == user_id, Friendship.user2_id == user_id))
            .order_by(Friendship.created_at.desc())
            .all()
        )
        if not rows:
            return []

        friend_id_by_row = {
            row.id: (row.user2_id if row.user1_id == user_id else row.user1_id)
            for row in rows
        }
        friend_ids = list(friend_id_by_row.values())
        friends_by_id = {u.id: u for u in db.query(User).filter(User.id.in_(friend_ids)).all()}

        results = []
        for row in rows:
            friend_id = friend_id_by_row[row.id]
            friend = friends_by_id.get(friend_id)
            if not friend:
                continue
            results.append({"friend": friend, "friends_since": row.created_at})
        return results

    @staticmethod
    def unfriend(db: Session, user_id: uuid.UUID, other_user_id: uuid.UUID) -> None:
        friendship = FriendService._get_friendship(db, user_id, other_user_id)
        if not friendship:
            raise NotFriendsException()
        db.delete(friendship)

        # Clear any resolved friend request between these two users (either
        # direction) so a fresh request can be sent after unfriending.
        db.query(FriendRequest).filter(
            or_(
                and_(FriendRequest.from_user_id == user_id, FriendRequest.to_user_id == other_user_id),
                and_(FriendRequest.from_user_id == other_user_id, FriendRequest.to_user_id == user_id),
            )
        ).delete(synchronize_session=False)

        db.commit()