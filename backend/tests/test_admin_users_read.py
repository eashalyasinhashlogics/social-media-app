import uuid
from unittest.mock import patch
from fastapi.testclient import TestClient
from app.main import app
from app.db.database import SessionLocal
from app.models.user import User
from app.models.user_profile import UserProfile
from app.models.refresh_token import RefreshToken
from app.models.user_session import UserSession
from app.db.enums import UserRole, UserStatus

client = TestClient(app)


async def _fake_send_otp_email(email, otp_code):
    return None


def _register_verified_user(as_admin: bool = False):
    email = f"admin_read_{uuid.uuid4().hex[:8]}@example.com"
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
    if as_admin:
        user.role = UserRole.admin
    db.add(user)
    db.commit()
    user_id = user.id
    db.close()

    resp = client.post("/api/v1/auth/login", json={"email": email, "password": password})
    assert resp.status_code == 200
    token = resp.json()["access_token"]

    return user_id, {"Authorization": f"Bearer {token}"}


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


def test_list_users_requires_admin():
    user_id, headers = _register_verified_user(as_admin=False)
    try:
        resp = client.get("/api/v1/admin/users", headers=headers)
        assert resp.status_code == 403
    finally:
        _cleanup_user(user_id)


def test_list_users_returns_seeded_users():
    admin_id, admin_headers = _register_verified_user(as_admin=True)
    user_id, _ = _register_verified_user(as_admin=False)
    try:
        resp = client.get("/api/v1/admin/users?limit=100", headers=admin_headers)
        assert resp.status_code == 200
        body = resp.json()
        ids = [item["id"] for item in body["items"]]
        assert str(admin_id) in ids
        assert str(user_id) in ids
        assert body["total"] >= 2
    finally:
        _cleanup_user(user_id)
        _cleanup_user(admin_id)


def test_filter_by_blocked_status():
    admin_id, admin_headers = _register_verified_user(as_admin=True)
    user_id, _ = _register_verified_user(as_admin=False)
    try:
        _set_status(user_id, UserStatus.blocked)
        resp = client.get("/api/v1/admin/users?status=blocked", headers=admin_headers)
        assert resp.status_code == 200
        ids = [item["id"] for item in resp.json()["items"]]
        assert str(user_id) in ids
        assert str(admin_id) not in ids
    finally:
        _cleanup_user(user_id)
        _cleanup_user(admin_id)


def test_get_single_user_detail():
    admin_id, admin_headers = _register_verified_user(as_admin=True)
    user_id, _ = _register_verified_user(as_admin=False)
    try:
        resp = client.get(f"/api/v1/admin/users/{user_id}", headers=admin_headers)
        assert resp.status_code == 200
        assert resp.json()["id"] == str(user_id)
    finally:
        _cleanup_user(user_id)
        _cleanup_user(admin_id)


def test_get_nonexistent_user_404():
    admin_id, admin_headers = _register_verified_user(as_admin=True)
    try:
        resp = client.get(f"/api/v1/admin/users/{uuid.uuid4()}", headers=admin_headers)
        assert resp.status_code == 404
    finally:
        _cleanup_user(admin_id)
