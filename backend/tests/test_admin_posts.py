import uuid
from unittest.mock import patch
from fastapi.testclient import TestClient
from app.main import app
from app.db.database import SessionLocal
from app.models.user import User
from app.models.user_profile import UserProfile
from app.models.refresh_token import RefreshToken
from app.models.user_session import UserSession
from app.models.post import Post
from app.db.enums import UserRole

client = TestClient(app)


async def _fake_send_otp_email(email, otp_code):
    return None


def _register_verified_user(as_admin: bool = False):
    email = f"admin_posts_{uuid.uuid4().hex[:8]}@example.com"
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


def _create_post(headers, content="hello"):
    resp = client.post("/api/v1/posts", json={"content": content}, headers=headers)
    assert resp.status_code == 201
    return resp.json()["id"]


def _cleanup(user_ids, post_ids):
    db = SessionLocal()
    if post_ids:
        db.query(Post).filter(Post.id.in_(post_ids)).delete(synchronize_session=False)
    for user_id in user_ids:
        db.query(UserSession).filter(UserSession.user_id == user_id).delete(synchronize_session=False)
        db.query(RefreshToken).filter(RefreshToken.user_id == user_id).delete(synchronize_session=False)
        db.query(UserProfile).filter(UserProfile.user_id == user_id).delete()
        db.query(User).filter(User.id == user_id).delete()
    db.commit()
    db.close()


def test_admin_can_edit_others_post():
    admin_id, admin_headers = _register_verified_user(as_admin=True)
    owner_id, owner_headers = _register_verified_user(as_admin=False)
    try:
        post_id = _create_post(owner_headers, "original content")

        resp = client.patch(
            f"/api/v1/admin/posts/{post_id}",
            json={"content": "edited by admin"},
            headers=admin_headers,
        )
        assert resp.status_code == 200
        assert resp.json()["content"] == "edited by admin"
    finally:
        _cleanup([admin_id, owner_id], [post_id])


def test_admin_can_delete_others_post():
    admin_id, admin_headers = _register_verified_user(as_admin=True)
    owner_id, owner_headers = _register_verified_user(as_admin=False)
    try:
        post_id = _create_post(owner_headers, "to be deleted")

        resp = client.delete(f"/api/v1/admin/posts/{post_id}", headers=admin_headers)
        assert resp.status_code == 200
        assert resp.json()["status"] == "deleted"

        # deleting again is a no-op, not a crash
        resp = client.delete(f"/api/v1/admin/posts/{post_id}", headers=admin_headers)
        assert resp.status_code == 200
        assert resp.json()["status"] == "deleted"
    finally:
        _cleanup([admin_id, owner_id], [post_id])


def test_non_admin_cannot_use_admin_post_routes():
    owner_id, owner_headers = _register_verified_user(as_admin=False)
    other_id, other_headers = _register_verified_user(as_admin=False)
    try:
        post_id = _create_post(owner_headers, "not admin's business")

        resp = client.patch(
            f"/api/v1/admin/posts/{post_id}",
            json={"content": "hijacked"},
            headers=other_headers,
        )
        assert resp.status_code == 403

        resp = client.delete(f"/api/v1/admin/posts/{post_id}", headers=other_headers)
        assert resp.status_code == 403
    finally:
        _cleanup([owner_id, other_id], [post_id])


def test_regular_ownership_check_still_enforced():
    """Regression guard: the admin bypass must not have weakened the
    normal, non-admin ownership check on /api/v1/posts/{id}."""
    owner_id, owner_headers = _register_verified_user(as_admin=False)
    other_id, other_headers = _register_verified_user(as_admin=False)
    try:
        post_id = _create_post(owner_headers, "still protected")

        resp = client.patch(
            f"/api/v1/posts/{post_id}",
            json={"content": "hijacked"},
            headers=other_headers,
        )
        assert resp.status_code == 403
    finally:
        _cleanup([owner_id, other_id], [post_id])


def test_admin_deleted_post_returns_404_on_public_route():
    admin_id, admin_headers = _register_verified_user(as_admin=True)
    owner_id, owner_headers = _register_verified_user(as_admin=False)
    try:
        post_id = _create_post(owner_headers, "will vanish publicly")
        client.delete(f"/api/v1/admin/posts/{post_id}", headers=admin_headers)

        resp = client.get(f"/api/v1/posts/{post_id}", headers=owner_headers)
        assert resp.status_code == 404
    finally:
        _cleanup([admin_id, owner_id], [post_id])
