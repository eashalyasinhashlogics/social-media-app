from sqlalchemy.orm import Session
from app.models.user import User
from app.schemas.user import UserCreate
from app.core.security import hash_password, verify_password
from app.core.exceptions import UserAlreadyExistsException, InvalidCredentialsException, UserBlockedException
from app.db.enums import UserStatus
from app.models.user_profile import UserProfile
from typing import Optional, List
import uuid
from app.models.media import Media
from app.models.follow import Follow

class UserService:

    @staticmethod
    def create_user(db: Session, user_create: UserCreate) -> User:
        existing = db.query(User).filter(
            (User.email == user_create.email) | (User.username == user_create.username)
        ).first()
        if existing:
            raise UserAlreadyExistsException()

        user = User(
            email=user_create.email,
            username=user_create.username,
            password_hash=hash_password(user_create.password)
        )
        db.add(user)
        db.flush()
        profile = UserProfile(user_id=user.id)
        db.add(profile)
        db.commit()
        db.refresh(user)
        return user

    @staticmethod
    def authenticate_user(db: Session, email: str, password: str) -> User:
        user = db.query(User).filter(User.email == email).first()
        if not user:
            raise InvalidCredentialsException()
        if not verify_password(password, user.password_hash):
            raise InvalidCredentialsException()
        if user.status != UserStatus.active:
            raise UserBlockedException(user.status.value)
        return user

    @staticmethod
    def get_user_by_id(db: Session, user_id: str) -> User:
        return db.query(User).filter(User.id == user_id).first()

    @staticmethod
    def get_user_by_email(db: Session, email: str) -> User:
        return db.query(User).filter(User.email == email).first()

    @staticmethod
    def verify_email(db: Session, user_id: str) -> User:
        user = db.query(User).filter(User.id == user_id).first()
        if user:
            user.email_verified = True
            db.add(user)
            db.commit()
            db.refresh(user)
        return user

    @staticmethod
    def search_users(db: Session, query: str, viewer_id: Optional[uuid.UUID], skip: int = 0, limit: int = 20) -> list:
        users_q = db.query(User).filter(User.deleted_at.is_(None), User.status == UserStatus.active)
        if query:
            users_q = users_q.filter(User.username.ilike(f"%{query}%"))
        users = users_q.order_by(User.username.asc()).offset(skip).limit(limit).all()
        return UserService._shape_users(db, users, viewer_id)

    @staticmethod
    def list_featured(db: Session, viewer_id: Optional[uuid.UUID], limit: int = 8) -> list:
        rows = (
            db.query(User)
            .join(UserProfile, UserProfile.user_id == User.id)
            .filter(User.deleted_at.is_(None), User.status == UserStatus.active)
            .order_by(UserProfile.follower_count.desc())
            .limit(limit)
            .all()
        )
        return UserService._shape_users(db, rows, viewer_id)

    @staticmethod
    def _shape_users(db: Session, users: List[User], viewer_id: Optional[uuid.UUID]) -> list:
        if not users:
            return []
        user_ids = [u.id for u in users]
        profiles_by_user_id = {
            p.user_id: p for p in db.query(UserProfile).filter(UserProfile.user_id.in_(user_ids)).all()
        }
        picture_ids = {p.profile_picture_id for p in profiles_by_user_id.values() if p.profile_picture_id}
        media_by_id = {m.id: m for m in db.query(Media).filter(Media.id.in_(picture_ids)).all()} if picture_ids else {}

        following_ids = set()
        if viewer_id:
            following_ids = {
                row[0]
                for row in db.query(Follow.following_id)
                .filter(Follow.follower_id == viewer_id, Follow.following_id.in_(user_ids))
                .all()
            }

        results = []
        for user in users:
            if viewer_id and user.id == viewer_id:
                continue
            profile = profiles_by_user_id.get(user.id)
            avatar = media_by_id.get(profile.profile_picture_id) if profile and profile.profile_picture_id else None
            results.append({
                "id": user.id,
                "username": user.username,
                "display_name": profile.display_name if profile else None,
                "avatar_url": avatar.url if avatar else None,
                "follower_count": profile.follower_count if profile else 0,
                "is_following": user.id in following_ids,
            })
        return results