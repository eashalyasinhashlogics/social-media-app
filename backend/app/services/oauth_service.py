from sqlalchemy.orm import Session
from app.models.user import User
from app.models.oauth import OAuthCredentials
from app.models.user_profile import UserProfile
from app.db.enums import UserStatus
import uuid

class OAuthService:

    @staticmethod
    def find_or_create_user(
        db: Session,
        provider: str,
        provider_user_id: str,
        email: str,
        name: str
    ) -> User:
        oauth_cred = db.query(OAuthCredentials).filter(
            OAuthCredentials.provider == provider,
            OAuthCredentials.provider_user_id == provider_user_id
        ).first()

        if oauth_cred:
            return oauth_cred.user

        user = db.query(User).filter(User.email == email).first()

        if user:
            oauth_cred = OAuthCredentials(
                user_id=user.id,
                provider=provider,
                provider_user_id=provider_user_id
            )
            db.add(oauth_cred)
            db.commit()
            return user

        username = email.split("@")[0]
        existing_username = db.query(User).filter(User.username == username).first()
        if existing_username:
            username = f"{username}_{uuid.uuid4().hex[:6]}"

        user = User(
            email=email,
            username=username,
            password_hash="",
            email_verified=True,
            status=UserStatus.active
        )
        db.add(user)
        db.flush()

        profile = UserProfile(user_id=user.id)
        db.add(profile)

        oauth_cred = OAuthCredentials(
            user_id=user.id,
            provider=provider,
            provider_user_id=provider_user_id
        )
        db.add(oauth_cred)
        db.commit()
        db.refresh(user)

        return user
