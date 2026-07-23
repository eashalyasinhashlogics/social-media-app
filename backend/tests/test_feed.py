import uuid
from unittest.mock import patch
from fastapi.testclient import TestClient
from app.main import app
from app.db.database import SessionLocal
from app.models.user import User
from app.models.user_profile import UserProfile
from app.models.post import Post
from app.models.follow import Follow

client = TestClient(app)


async def _fake_send_otp_email(email, otp_code):
    """Stand-in for the real SMTP call so registration doesn't hit a live mail server."""
    return None


def _register_verified_user():
    """Register a user, mark them verified, log in, and return (user_id, auth_headers)."""
    email = f"feed_{uuid.uuid4().hex[:8]}@example.com"
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


def _cleanup_user(user_id):
    db = SessionLocal()
    db.query(Follow).filter(
        (Follow.follower_id == user_id) | (Follow.following_id == user_id)
    ).delete(synchronize_session=False)
    db.query(Post).filter(Post.author_id == user_id).delete()
    db.query(UserProfile).filter(UserProfile.user_id == user_id).delete()
    db.query(User).filter(User.id == user_id).delete()
    db.commit()
    db.close()


# ---------- feed contents ----------

def test_feed_empty_when_following_no_one():
    user_id, headers = _register_verified_user()
    try:
        resp = client.get("/api/v1/posts/feed/following", headers=headers)
        assert resp.status_code == 200
        assert resp.json() == []
    finally:
        _cleanup_user(user_id)


def test_feed_requires_auth():
    resp = client.get("/api/v1/posts/feed/following")
    assert resp.status_code == 401


def test_feed_shows_only_followed_authors_posts():
    viewer_id, viewer_headers = _register_verified_user()
    followed_id, followed_headers = _register_verified_user()
    stranger_id, stranger_headers = _register_verified_user()
    try:
        client.post(f"/api/v1/users/{followed_id}/follow", headers=viewer_headers)

        resp = client.post("/api/v1/posts", json={"content": "from followed"}, headers=followed_headers)
        followed_post_id = resp.json()["id"]

        client.post("/api/v1/posts", json={"content": "from stranger"}, headers=stranger_headers)

        resp = client.get("/api/v1/posts/feed/following", headers=viewer_headers)
        assert resp.status_code == 200
        feed_post_ids = {p["id"] for p in resp.json()}
        assert followed_post_id in feed_post_ids
        assert len(feed_post_ids) == 1
    finally:
        _cleanup_user(viewer_id)
        _cleanup_user(followed_id)
        _cleanup_user(stranger_id)


def test_feed_excludes_own_posts():
    viewer_id, viewer_headers = _register_verified_user()
    try:
        client.post("/api/v1/posts", json={"content": "my own post"}, headers=viewer_headers)

        resp = client.get("/api/v1/posts/feed/following", headers=viewer_headers)
        assert resp.status_code == 200
        assert resp.json() == []
    finally:
        _cleanup_user(viewer_id)


def test_feed_excludes_archived_posts():
    viewer_id, viewer_headers = _register_verified_user()
    followed_id, followed_headers = _register_verified_user()
    try:
        client.post(f"/api/v1/users/{followed_id}/follow", headers=viewer_headers)

        resp = client.post("/api/v1/posts", json={"content": "will be archived"}, headers=followed_headers)
        post_id = resp.json()["id"]
        client.patch(f"/api/v1/posts/{post_id}/archive", headers=followed_headers)

        resp = client.get("/api/v1/posts/feed/following", headers=viewer_headers)
        assert resp.status_code == 200
        assert all(p["id"] != post_id for p in resp.json())
    finally:
        _cleanup_user(viewer_id)
        _cleanup_user(followed_id)


# ---------- pagination / ordering ----------

def test_feed_pagination():
    viewer_id, viewer_headers = _register_verified_user()
    followed_id, followed_headers = _register_verified_user()
    try:
        client.post(f"/api/v1/users/{followed_id}/follow", headers=viewer_headers)

        for i in range(5):
            client.post("/api/v1/posts", json={"content": f"post {i}"}, headers=followed_headers)

        resp = client.get("/api/v1/posts/feed/following?skip=0&limit=2", headers=viewer_headers)
        assert resp.status_code == 200
        assert len(resp.json()) == 2

        resp = client.get("/api/v1/posts/feed/following?skip=2&limit=2", headers=viewer_headers)
        assert resp.status_code == 200
        assert len(resp.json()) == 2


        resp = client.get("/api/v1/posts/feed/following?skip=4&limit=2", headers=viewer_headers)
        assert resp.status_code == 200
        assert len(resp.json()) == 1
    finally:
        _cleanup_user(viewer_id)
        _cleanup_user(followed_id)


def test_feed_newest_first():
    viewer_id, viewer_headers = _register_verified_user()
    followed_id, followed_headers = _register_verified_user()
    try:
        client.post(f"/api/v1/users/{followed_id}/follow", headers=viewer_headers)

        first = client.post("/api/v1/posts", json={"content": "first"}, headers=followed_headers).json()["id"]
        second = client.post("/api/v1/posts", json={"content": "second"}, headers=followed_headers).json()["id"]

        resp = client.get("/api/v1/posts/feed/following", headers=viewer_headers)
        assert resp.status_code == 200
        feed_ids = [p["id"] for p in resp.json()]
        assert feed_ids.index(second) < feed_ids.index(first)
    finally:
        _cleanup_user(viewer_id)
        _cleanup_user(followed_id)


# ---------- follow-state changes reflected in feed ----------

def test_feed_unfollow_removes_posts_from_feed():
    viewer_id, viewer_headers = _register_verified_user()
    followed_id, followed_headers = _register_verified_user()
    try:
        client.post(f"/api/v1/users/{followed_id}/follow", headers=viewer_headers)
        client.post("/api/v1/posts", json={"content": "hello"}, headers=followed_headers)

        resp = client.get("/api/v1/posts/feed/following", headers=viewer_headers)
        assert len(resp.json()) == 1

        client.delete(f"/api/v1/users/{followed_id}/follow", headers=viewer_headers)

        resp = client.get("/api/v1/posts/feed/following", headers=viewer_headers)
        assert resp.json() == []
    finally:
        _cleanup_user(viewer_id)
        _cleanup_user(followed_id)