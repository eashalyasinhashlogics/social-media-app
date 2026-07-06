import uuid
from datetime import datetime, timedelta
from app.services.user_service import UserService
from app.services.otp_service import OTPService
from app.schemas.user import UserCreate
from app.db.enums import OTPType
from app.models.otp import OTPVerification

def _make_user(db):
    email = f"otp_{uuid.uuid4().hex[:8]}@example.com"
    data = UserCreate(email=email, username=f"u{uuid.uuid4().hex[:8]}", password="TestPass123!")
    return UserService.create_user(db, data)

def test_otp_send_and_verify(db):
    user = _make_user(db)
    code = OTPService.send_otp(db, str(user.id), OTPType.email_verification)
    is_valid, msg = OTPService.verify_otp(db, str(user.id), code, OTPType.email_verification)
    assert is_valid is True
    db.delete(user)
    db.commit()

def test_otp_wrong_code(db):
    user = _make_user(db)
    OTPService.send_otp(db, str(user.id), OTPType.email_verification)
    is_valid, msg = OTPService.verify_otp(db, str(user.id), "000000", OTPType.email_verification)
    assert is_valid is False
    db.delete(user)
    db.commit()

def test_otp_max_attempts(db):
    user = _make_user(db)
    OTPService.send_otp(db, str(user.id), OTPType.email_verification)
    for _ in range(5):
        OTPService.verify_otp(db, str(user.id), "000000", OTPType.email_verification)
    is_valid, msg = OTPService.verify_otp(db, str(user.id), "000000", OTPType.email_verification)
    assert is_valid is False
    assert "too many" in msg.lower()
    db.delete(user)
    db.commit()

def test_otp_expired(db):
    user = _make_user(db)
    code = OTPService.send_otp(db, str(user.id), OTPType.email_verification)
    otp = db.query(OTPVerification).filter(OTPVerification.user_id == user.id).first()
    otp.expires_at = datetime.utcnow() - timedelta(seconds=1)
    db.add(otp)
    db.commit()

    is_valid, msg = OTPService.verify_otp(db, str(user.id), code, OTPType.email_verification)
    assert is_valid is False
    assert "expired" in msg.lower()
    db.delete(user)
    db.commit()
