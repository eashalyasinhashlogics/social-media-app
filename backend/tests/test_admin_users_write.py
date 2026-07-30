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
    email = f"admin_write_{uuid.uuid4().hex[:8]}@example.com"
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

    return user_id, {"Authorization": f"Bearer {token}"}, email, password


def _cleanup_user(user_id):
    db = SessionLocal()
    db.query(UserSession).filter(UserSession.user_id == user_id).delete(synchronize_session=False)
    db.query(RefreshToken).filter(RefreshToken.user_id == user_id).delete(synchronize_session=False)
    db.query(UserProfile).filter(UserProfile.user_id == user_id).delete()
    db.query(User).filter(User.id == user_id).delete()
    db.commit()
    db.close()


def test_admin_can_edit_user_role():
    admin_id, admin_headers, _, _ = _register_verified_user(as_admin=True)
    user_id, _, _, _ = _register_verified_user(as_admin=False)
    try:
        resp = client.patch(
            f"/api/v1/admin/users/{user_id}",
            json={"role": "admin"},
            headers=admin_headers,
        )
        assert resp.status_code == 200
        assert resp.json()["role"] == "admin"
    finally:
        _cleanup_user(user_id)
        _cleanup_user(admin_id)


def test_admin_can_soft_delete_user():
    admin_id, admin_headers, _, _ = _register_verified_user(as_admin=True)
    user_id, _, _, _ = _register_verified_user(as_admin=False)
    try:
        resp = client.delete(f"/api/v1/admin/users/{user_id}", headers=admin_headers)
        assert resp.status_code == 200
        body = resp.json()
        assert body["status"] == "deleted"
        assert body["deleted_at"] is not None
    finally:
        _cleanup_user(user_id)
        _cleanup_user(admin_id)


def test_admin_block_then_target_cannot_login():
    admin_id, admin_headers, _, _ = _register_verified_user(as_admin=True)
    user_id, _, email, password = _register_verified_user(as_admin=False)
    try:
        resp = client.post(f"/api/v1/admin/users/{user_id}/block", headers=admin_headers)
        assert resp.status_code == 200
        assert resp.json()["status"] == "blocked"

        resp = client.post("/api/v1/auth/login", json={"email": email, "password": password})
        assert resp.status_code == 403
    finally:
        _cleanup_user(user_id)
        _cleanup_user(admin_id)


def test_admin_unblock_restores_login():
    admin_id, admin_headers, _, _ = _register_verified_user(as_admin=True)
    user_id, _, email, password = _register_verified_user(as_admin=False)
    try:
        client.post(f"/api/v1/admin/users/{user_id}/block", headers=admin_headers)
        resp = client.post(f"/api/v1/admin/users/{user_id}/unblock", headers=admin_headers)
        assert resp.status_code == 200
        assert resp.json()["status"] == "active"

        resp = client.post("/api/v1/auth/login", json={"email": email, "password": password})
        assert resp.status_code == 200
    finally:
        _cleanup_user(user_id)
        _cleanup_user(admin_id)


def test_non_admin_cannot_edit_users():
    user_a_id, headers_a, _, _ = _register_verified_user(as_admin=False)
    user_b_id, _, _, _ = _register_verified_user(as_admin=False)
    try:
        resp = client.patch(
            f"/api/v1/admin/users/{user_b_id}",
            json={"role": "admin"},
            headers=headers_a,
        )
        assert resp.status_code == 403
    finally:
        _cleanup_user(user_a_id)
        _cleanup_user(user_b_id)
