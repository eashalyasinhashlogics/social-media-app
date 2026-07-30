import uuid
from unittest.mock import patch
from fastapi.testclient import TestClient
from app.main import app
from app.db.database import SessionLocal
from app.models.user import User
from app.models.user_profile import UserProfile
from app.models.refresh_token import RefreshToken
from app.models.user_session import UserSession
from app.db.enums import UserRole

client = TestClient(app)


async def _fake_send_otp_email(email, otp_code):
    return None


def _register_verified_user(as_admin: bool = False):
    email = f"admin_errors_{uuid.uuid4().hex[:8]}@example.com"
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


def _cleanup_user(user_id):
    db = SessionLocal()
    db.query(UserSession).filter(UserSession.user_id == user_id).delete(synchronize_session=False)
    db.query(RefreshToken).filter(RefreshToken.user_id == user_id).delete(synchronize_session=False)
    db.query(UserProfile).filter(UserProfile.user_id == user_id).delete()
    db.query(User).filter(User.id == user_id).delete()
    db.commit()
    db.close()


def test_invalid_uuid_in_path_returns_422_not_500():
    admin_id, headers = _register_verified_user(as_admin=True)
    try:
        resp = client.get("/api/v1/admin/users/not-a-uuid", headers=headers)
        assert resp.status_code == 422
        assert "detail" in resp.json()
    finally:
        _cleanup_user(admin_id)


def test_invalid_role_value_returns_422_not_500():
    admin_id, headers = _register_verified_user(as_admin=True)
    user_id, _ = _register_verified_user(as_admin=False)
    try:
        resp = client.patch(
            f"/api/v1/admin/users/{user_id}",
            json={"role": "superuser"},
            headers=headers,
        )
        assert resp.status_code == 422
    finally:
        _cleanup_user(user_id)
        _cleanup_user(admin_id)


def test_stats_days_out_of_range_returns_422():
    admin_id, headers = _register_verified_user(as_admin=True)
    try:
        resp = client.get("/api/v1/admin/stats?days=0", headers=headers)
        assert resp.status_code == 422
    finally:
        _cleanup_user(admin_id)


def test_nonexistent_post_delete_returns_404_not_500():
    admin_id, headers = _register_verified_user(as_admin=True)
    try:
        resp = client.delete(f"/api/v1/admin/posts/{uuid.uuid4()}", headers=headers)
        assert resp.status_code == 404
        assert "detail" in resp.json()
    finally:
        _cleanup_user(admin_id)


def test_nonexistent_user_patch_returns_404_not_500():
    admin_id, headers = _register_verified_user(as_admin=True)
    try:
        resp = client.patch(
            f"/api/v1/admin/users/{uuid.uuid4()}",
            json={"username": "doesnotexist"},
            headers=headers,
        )
        assert resp.status_code == 404
    finally:
        _cleanup_user(admin_id)
