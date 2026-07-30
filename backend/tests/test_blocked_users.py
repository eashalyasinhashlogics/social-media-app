import uuid
from unittest.mock import patch
from fastapi.testclient import TestClient
from app.main import app
from app.db.database import SessionLocal
from app.models.user import User
from app.models.user_profile import UserProfile
from app.models.refresh_token import RefreshToken
from app.models.user_session import UserSession
from app.db.enums import UserStatus

client = TestClient(app)


async def _fake_send_otp_email(email, otp_code):
    return None


def _register_verified_user():
    email = f"blocked_{uuid.uuid4().hex[:8]}@example.com"
    username = f"u{uuid.uuid4().hex[:8]}"
    password = "SecurePass123!"

    with patch("app.api.v1.endpoints.auth.send_otp_email", _fake_send_otp_email):
        resp = client.post(
            "/api/v1/auth/register",
            json={"email": email, "username": username, "password": password},
        )
    assert resp.status_code == 201

    db = SessionLocal()
    user = db.query(User).filter(User.email == email).first()
    user.email_verified = True
    db.add(user)
    db.commit()
    user_id = user.id
    db.close()

    return user_id, email, password


def _login(email, password):
    return client.post("/api/v1/auth/login", json={"email": email, "password": password})


def _set_status(user_id, status_value):
    db = SessionLocal()
    user = db.query(User).filter(User.id == user_id).first()
    user.status = status_value
    db.add(user)
    db.commit()
    db.close()


def _cleanup_user(user_id):
    db = SessionLocal()
    db.query(UserSession).filter(UserSession.user_id == user_id).delete(synchronize_session=False)
    db.query(RefreshToken).filter(RefreshToken.user_id == user_id).delete(synchronize_session=False)
    db.query(UserProfile).filter(UserProfile.user_id == user_id).delete()
    db.query(User).filter(User.id == user_id).delete()
    db.commit()
    db.close()


def test_active_user_can_login():
    user_id, email, password = _register_verified_user()
    try:
        resp = _login(email, password)
        assert resp.status_code == 200
        assert "access_token" in resp.json()
    finally:
        _cleanup_user(user_id)


def test_blocked_user_cannot_login():
    user_id, email, password = _register_verified_user()
    try:
        _set_status(user_id, UserStatus.blocked)
        resp = _login(email, password)
        assert resp.status_code == 403
    finally:
        _cleanup_user(user_id)


def test_blocked_user_cannot_create_post_with_existing_token():
    user_id, email, password = _register_verified_user()
    try:
        resp = _login(email, password)
        token = resp.json()["access_token"]
        headers = {"Authorization": f"Bearer {token}"}

        # Block happens AFTER the token was issued - this is the exact
        # gap get_current_user needed to close.
        _set_status(user_id, UserStatus.blocked)

        resp = client.post("/api/v1/posts", json={"content": "hello"}, headers=headers)
        assert resp.status_code == 403
    finally:
        _cleanup_user(user_id)


def test_suspended_user_also_blocked_from_protected_routes():
    user_id, email, password = _register_verified_user()
    try:
        resp = _login(email, password)
        token = resp.json()["access_token"]
        headers = {"Authorization": f"Bearer {token}"}

        _set_status(user_id, UserStatus.suspended)

        resp = client.post("/api/v1/posts", json={"content": "hello"}, headers=headers)
        assert resp.status_code == 403
    finally:
        _cleanup_user(user_id)
