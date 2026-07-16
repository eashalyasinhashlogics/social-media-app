from sqlalchemy.orm import Session
from datetime import datetime, timezone, timedelta
from app.models.user import User
from app.models.refresh_token import RefreshToken
from app.models.user_session import UserSession
from app.core.security import create_access_token, create_refresh_token, decode_token, hash_password, verify_password
from app.schemas.auth import TokenResponse
from app.schemas.user import UserCreate
from app.services.user_service import UserService
from app.services.otp_service import OTPService
from app.services.oauth_service import OAuthService
from app.db.enums import OTPType
from app.config import REFRESH_TOKEN_EXPIRE_DAYS
from app.core.exceptions import UserNotVerifiedException, InvalidTokenException
from fastapi import HTTPException, status

class AuthService:

    @staticmethod
    def register(db: Session, user_create: UserCreate) -> dict:
        user = UserService.create_user(db, user_create)
        OTPService.send_otp(db, str(user.id), OTPType.email_verification)
        return {
            "message": f"User registered. OTP sent to {user.email}",
            "user_id": str(user.id),
            "email": user.email
        }

    @staticmethod
    def _persist_refresh_token(db: Session, user: User, refresh_token: str, ip_address: str, user_agent: str):
        token_record = RefreshToken(
            user_id=user.id,
            token_hash=hash_password(refresh_token),
            expires_at=datetime.now(timezone.utc) + timedelta(days=REFRESH_TOKEN_EXPIRE_DAYS),
            revoked=False
        )
        db.add(token_record)
        db.flush()

        session = UserSession(
            user_id=user.id,
            refresh_token_id=token_record.id,
            ip_address=ip_address or "unknown",
            user_agent=user_agent or "unknown"
        )
        db.add(session)
        db.commit()

    @staticmethod
    def login(db: Session, email: str, password: str, ip_address: str = "unknown", user_agent: str = "unknown") -> TokenResponse:
        user = UserService.authenticate_user(db, email, password)
        if not user.email_verified:
            raise UserNotVerifiedException()

        access_token = create_access_token(data={"sub": str(user.id)})
        refresh_token = create_refresh_token(data={"sub": str(user.id)})

        AuthService._persist_refresh_token(db, user, refresh_token, ip_address, user_agent)

        return TokenResponse(access_token=access_token, refresh_token=refresh_token)

    @staticmethod
    def verify_email_otp(db: Session, email: str, otp_code: str) -> dict:
        user = UserService.get_user_by_email(db, email)
        if not user:
            raise HTTPException(status_code=status.HTTP_404_NOT_FOUND, detail="User not found")

        is_valid, message = OTPService.verify_otp(db, str(user.id), otp_code, OTPType.email_verification)
        if not is_valid:
            raise HTTPException(status_code=status.HTTP_400_BAD_REQUEST, detail=message)

        UserService.verify_email(db, str(user.id))
        return {"message": "Email verified successfully"}

    @staticmethod
    def refresh_access_token(db: Session, refresh_token: str) -> TokenResponse:
        try:
            payload = decode_token(refresh_token)
            if payload.get("type") != "refresh":
                raise InvalidTokenException()

            user_id = payload.get("sub")
            user = UserService.get_user_by_id(db, user_id)
            if not user:
                raise InvalidTokenException()

            # Find matching non-revoked token record
            candidates = db.query(RefreshToken).filter(
                RefreshToken.user_id == user_id,
                RefreshToken.revoked == False
            ).all()

            matched = None
            for candidate in candidates:
                if verify_password(refresh_token, candidate.token_hash):
                    matched = candidate
                    break

            if not matched or matched.expires_at < datetime.utcnow():
                raise InvalidTokenException()

            matched.revoked = True
            db.add(matched)
            db.commit()

            access_token = create_access_token(data={"sub": str(user.id)})
            new_refresh_token = create_refresh_token(data={"sub": str(user.id)})
            AuthService._persist_refresh_token(db, user, new_refresh_token, "unknown", "unknown")

            return TokenResponse(access_token=access_token, refresh_token=new_refresh_token)
        except InvalidTokenException:
            raise
        except Exception:
            raise InvalidTokenException()
    @staticmethod
    def oauth_login(db: Session, provider: str, provider_user_id: str, email: str, name: str, ip_address: str = "unknown", user_agent: str = "unknown") -> TokenResponse:
        user = OAuthService.find_or_create_user(db, provider, provider_user_id, email, name)

        access_token = create_access_token(data={"sub": str(user.id)})
        refresh_token = create_refresh_token(data={"sub": str(user.id)})

        AuthService._persist_refresh_token(db, user, refresh_token, ip_address, user_agent)

        return TokenResponse(access_token=access_token, refresh_token=refresh_token)

    @staticmethod
    def logout(db: Session, user_id: str, refresh_token: str) -> dict:
        candidates = db.query(RefreshToken).filter(
            RefreshToken.user_id == user_id,
            RefreshToken.revoked == False
        ).all()

        for candidate in candidates:
            if verify_password(refresh_token, candidate.token_hash):
                candidate.revoked = True
                db.add(candidate)
                db.commit()
                return {"message": "Logged out successfully"}

        raise InvalidTokenException()

