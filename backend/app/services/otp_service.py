import random
import string
from datetime import datetime, timedelta
from sqlalchemy.orm import Session
from app.models.otp import OTPVerification
from app.db.enums import OTPType
from app.core.security import hash_password, verify_password

class OTPService:

    OTP_LENGTH = 6
    OTP_EXPIRY_MINUTES = 10
    MAX_ATTEMPTS = 5

    @staticmethod
    def generate_otp() -> str:
        return "".join(random.choices(string.digits, k=OTPService.OTP_LENGTH))

    @staticmethod
    def send_otp(db: Session, user_id: str, otp_type: OTPType = OTPType.email_verification) -> str:
        db.query(OTPVerification).filter(
            OTPVerification.user_id == user_id,
            OTPVerification.otp_type == otp_type,
            OTPVerification.used_at.is_(None)
        ).delete()

        otp_code = OTPService.generate_otp()
        otp = OTPVerification(
            user_id=user_id,
            otp_type=otp_type,
            otp_hash=hash_password(otp_code),
            expires_at=datetime.utcnow() + timedelta(minutes=OTPService.OTP_EXPIRY_MINUTES),
            max_attempts=OTPService.MAX_ATTEMPTS
        )
        db.add(otp)
        db.commit()

        print(f"\n[OTP DEBUG] Code for user {user_id}: {otp_code}")
        return otp_code

    @staticmethod
    def verify_otp(db: Session, user_id: str, otp_code: str, otp_type: OTPType = OTPType.email_verification):
        otp = db.query(OTPVerification).filter(
            OTPVerification.user_id == user_id,
            OTPVerification.otp_type == otp_type,
            OTPVerification.used_at.is_(None)
        ).order_by(OTPVerification.created_at.desc()).first()

        if not otp:
            return False, "No OTP found. Please request a new one."

        if otp.is_expired():
            return False, "OTP has expired. Please request a new one."

        if otp.is_max_attempts_exceeded():
            return False, "Too many failed attempts. Please request a new OTP."

        if not verify_password(otp_code, otp.otp_hash):
            otp.attempt_count += 1
            db.add(otp)
            db.commit()
            remaining = OTPService.MAX_ATTEMPTS - otp.attempt_count
            return False, f"Invalid OTP. {remaining} attempts remaining."

        otp.used_at = datetime.utcnow()
        db.add(otp)
        db.commit()
        return True, "OTP verified successfully"
