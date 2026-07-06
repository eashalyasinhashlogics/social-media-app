import uuid
from fastapi.testclient import TestClient
from app.main import app
from app.db.database import SessionLocal
from app.models.user import User
from app.services.otp_service import OTPService
from app.models.otp import OTPVerification

client = TestClient(app)

def _register_and_verify():
    email = f"http_{uuid.uuid4().hex[:8]}@example.com"
    username = f"u{uuid.uuid4().hex[:8]}"
    password = "SecurePass123!"

    resp = client.post("/api/v1/auth/register", json={"email": email, "username": username, "password": password})
    assert resp.status_code == 201

    db = SessionLocal()
    user = db.query(User).filter(User.email == email).first()
    otp = db.query(OTPVerification).filter(OTPVerification.user_id == user.id).order_by(OTPVerification.created_at.desc()).first()
    db.close()

    return email, username, password, user

def test_register_invalid_email_rejected():
    resp = client.post("/api/v1/auth/register", json={"email": "notanemail", "username": "user1", "password": "Pass1234!"})
    assert resp.status_code == 422

def test_register_short_password_rejected():
    resp = client.post("/api/v1/auth/register", json={"email": f"t_{uuid.uuid4().hex[:6]}@example.com", "username": "user2", "password": "short"})
    assert resp.status_code == 422

def test_login_nonexistent_user_rejected():
    resp = client.post("/api/v1/auth/login", json={"email": "nonexistent@example.com", "password": "SomePass123!"})
    assert resp.status_code == 401

def test_full_register_login_flow():
    email, username, password, user = _register_and_verify()

    # Login should fail before verification
    resp = client.post("/api/v1/auth/login", json={"email": email, "password": password})
    assert resp.status_code == 403

    db = SessionLocal()
    db_user = db.query(User).filter(User.email == email).first()
    db_user.email_verified = True
    db.add(db_user)
    db.commit()
    db.close()

    resp = client.post("/api/v1/auth/login", json={"email": email, "password": password})
    assert resp.status_code == 200
    tokens = resp.json()
    assert "access_token" in tokens

    me_resp = client.get("/api/v1/users/me", headers={"Authorization": f"Bearer {tokens['access_token']}"})
    assert me_resp.status_code == 200
    assert me_resp.json()["email"] == email

    db = SessionLocal()
    db_user = db.query(User).filter(User.email == email).first()
    db.delete(db_user)
    db.commit()
    db.close()

def test_register_rolls_back_user_on_email_failure(monkeypatch):
    import uuid
    from app.db.database import SessionLocal
    from app.models.user import User

    async def failing_send(*args, **kwargs):
        raise Exception("SMTP down")

    monkeypatch.setattr("app.api.v1.endpoints.auth.send_otp_email", failing_send)

    email = f"rollback_{uuid.uuid4().hex[:8]}@example.com"
    resp = client.post("/api/v1/auth/register", json={"email": email, "username": f"u{uuid.uuid4().hex[:8]}", "password": "SecurePass123!"})

    assert resp.status_code == 502

    db = SessionLocal()
    user = db.query(User).filter(User.email == email).first()
    assert user is None
    db.close()
