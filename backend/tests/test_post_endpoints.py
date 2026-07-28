import uuid
from unittest.mock import patch
from fastapi.testclient import TestClient
from app.main import app
from app.db.database import SessionLocal
from app.models.user import User
from app.models.user_profile import UserProfile
from app.models.post import Post

client = TestClient(app)


async def _fake_send_otp_email(email, otp_code):
    """Stand-in for the real SMTP call so registration doesn't hit a live mail server."""
    return None


def _register_verified_user():
    """Register a user, mark them verified, log in, and return (user_id, auth_headers)."""
    email = f"post_{uuid.uuid4().hex[:8]}@example.com"
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

    resp = client.post("/api/v1/auth/login", json={"email": email, "password": password})
    assert resp.status_code == 200
    token = resp.json()["access_token"]

    return user_id, {"Authorization": f"Bearer {token}"}


def _get_post_count(user_id):
    db = SessionLocal()
    profile = db.query(UserProfile).filter(UserProfile.user_id == user_id).first()
    count = profile.post_count
    db.close()
    return count


def _cleanup_user(user_id):
    db = SessionLocal()
    db.query(Post).filter(Post.author_id == user_id).delete()
    db.query(UserProfile).filter(UserProfile.user_id == user_id).delete()
    db.query(User).filter(User.id == user_id).delete()
    db.commit()
    db.close()


# ---------- create / read ----------

def test_create_and_read_post():
    user_id, headers = _register_verified_user()
    try:
        resp = client.post("/api/v1/posts", json={"content": "hello world"}, headers=headers)
        assert resp.status_code == 201
        post = resp.json()
        assert post["content"] == "hello world"
        assert post["status"] == "active"
        post_id = post["id"]

        resp = client.get("/api/v1/posts")
        assert resp.status_code == 200
        assert any(p["id"] == post_id for p in resp.json())

        resp = client.get(f"/api/v1/posts/{post_id}")
        assert resp.status_code == 200
        assert resp.json()["content"] == "hello world"
    finally:
        _cleanup_user(user_id)


def test_create_post_requires_auth():
    resp = client.post("/api/v1/posts", json={"content": "no auth"})
    assert resp.status_code == 401


def test_create_post_empty_content_rejected():
    user_id, headers = _register_verified_user()
    try:
        resp = client.post("/api/v1/posts", json={"content": ""}, headers=headers)
        assert resp.status_code == 422
    finally:
        _cleanup_user(user_id)


def test_get_nonexistent_post_404():
    resp = client.get(f"/api/v1/posts/{uuid.uuid4()}")
    assert resp.status_code == 404


# ---------- ownership: update / delete ----------

def test_update_post_ownership_enforced():
    user_a_id, headers_a = _register_verified_user()
    user_b_id, headers_b = _register_verified_user()
    try:
        resp = client.post("/api/v1/posts", json={"content": "original"}, headers=headers_a)
        post_id = resp.json()["id"]

        # User B (not the author) cannot update
        resp = client.patch(f"/api/v1/posts/{post_id}", json={"content": "hijacked"}, headers=headers_b)
        assert resp.status_code == 403

        # User A can update
        resp = client.patch(f"/api/v1/posts/{post_id}", json={"content": "updated"}, headers=headers_a)
        assert resp.status_code == 200
        assert resp.json()["content"] == "updated"
    finally:
        _cleanup_user(user_a_id)
        _cleanup_user(user_b_id)


def test_delete_post_ownership_and_soft_delete():
    user_a_id, headers_a = _register_verified_user()
    user_b_id, headers_b = _register_verified_user()
    try:
        resp = client.post("/api/v1/posts", json={"content": "to be deleted"}, headers=headers_a)
        post_id = resp.json()["id"]

        # User B cannot delete
        resp = client.delete(f"/api/v1/posts/{post_id}", headers=headers_b)
        assert resp.status_code == 403

        # User A can delete
        resp = client.delete(f"/api/v1/posts/{post_id}", headers=headers_a)
        assert resp.status_code == 204

        # Soft-deleted: excluded from lookups
        resp = client.get(f"/api/v1/posts/{post_id}")
        assert resp.status_code == 404
    finally:
        _cleanup_user(user_a_id)
        _cleanup_user(user_b_id)


# ---------- post_count sync ----------

def test_post_count_increments_and_decrements():
    user_id, headers = _register_verified_user()
    try:
        before = _get_post_count(user_id)

        resp = client.post("/api/v1/posts", json={"content": "count me"}, headers=headers)
        post_id = resp.json()["id"]
        after_create = _get_post_count(user_id)
        assert after_create == before + 1

        client.delete(f"/api/v1/posts/{post_id}", headers=headers)
        after_delete = _get_post_count(user_id)
        assert after_delete == before
    finally:
        _cleanup_user(user_id)


# ---------- archive / unarchive ----------

def test_archive_unarchive_flow():
    user_a_id, headers_a = _register_verified_user()
    user_b_id, headers_b = _register_verified_user()
    try:
        resp = client.post("/api/v1/posts", json={"content": "archive me"}, headers=headers_a)
        post_id = resp.json()["id"]
        count_before_archive = _get_post_count(user_a_id)

        # Archive
        resp = client.patch(f"/api/v1/posts/{post_id}/archive", headers=headers_a)
        assert resp.status_code == 200
        assert resp.json()["status"] == "archived"

        # Hidden from public feed
        resp = client.get("/api/v1/posts")
        assert all(p["id"] != post_id for p in resp.json())

        # Visible in owner's archived list
        resp = client.get("/api/v1/posts/me/archived", headers=headers_a)
        assert resp.status_code == 200
        assert any(p["id"] == post_id for p in resp.json())

        # post_count unaffected by archiving
        assert _get_post_count(user_a_id) == count_before_archive

        # Non-owner cannot archive/unarchive
        resp = client.patch(f"/api/v1/posts/{post_id}/archive", headers=headers_b)
        assert resp.status_code == 403

        # Unarchive
        resp = client.patch(f"/api/v1/posts/{post_id}/unarchive", headers=headers_a)
        assert resp.status_code == 200
        assert resp.json()["status"] == "active"

        # Back in public feed
        resp = client.get("/api/v1/posts")
        assert any(p["id"] == post_id for p in resp.json())
    finally:
        _cleanup_user(user_a_id)
        _cleanup_user(user_b_id)