from sqlalchemy.orm import Session
from app.models.user import User
from app.schemas.user import UserCreate
from app.core.security import hash_password, verify_password
from app.core.exceptions import UserAlreadyExistsException, InvalidCredentialsException, UserBlockedException
from app.db.enums import UserStatus
from app.models.user_profile import UserProfile

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

