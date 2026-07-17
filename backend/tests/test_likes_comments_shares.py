import uuid
from unittest.mock import patch
from fastapi.testclient import TestClient
from app.main import app
from app.db.database import SessionLocal
from app.models.user import User
from app.models.user_profile import UserProfile
from app.models.post import Post
from app.models.post_like import PostLike
from app.models.comment import Comment

client = TestClient(app)


async def _fake_send_otp_email(email, otp_code):
    """Stand-in for the real SMTP call so registration doesn't hit a live mail server."""
    return None


def _register_verified_user():
    """Register a user, mark them verified, log in, and return (user_id, auth_headers)."""
    email = f"social_{uuid.uuid4().hex[:8]}@example.com"
    username = f"u{uuid.uuid4().hex[:8]}"
    password = "SecurePass123!"

    # Clear any residual cookies before running to isolate authentication
    client.cookies.clear()

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
    """Clean up test database records for a given user ID."""
    db = SessionLocal()
    
    # 1. PostLike cleanup
    db.query(PostLike).filter(PostLike.user_id == user_id).delete()
    
    # 2. Comment cleanup (safely checks for user_id vs author_id)
    if hasattr(Comment, "user_id"):
        db.query(Comment).filter(Comment.user_id == user_id).delete()
    else:
        db.query(Comment).filter(Comment.author_id == user_id).delete()
        
    # 3. Post cleanup (safely checks for author_id vs user_id)
    if hasattr(Post, "author_id"):
        db.query(Post).filter(Post.author_id == user_id).delete()
    else:
        db.query(Post).filter(Post.user_id == user_id).delete()
        
    # 4. Profile and User cleanup
    db.query(UserProfile).filter(UserProfile.user_id == user_id).delete()
    db.query(User).filter(User.id == user_id).delete()
    
    db.commit()
    db.close()


def _create_post(headers, content="post for likes/comments/shares testing"):
    resp = client.post("/api/v1/posts", json={"content": content}, headers=headers)
    assert resp.status_code == 201
    return resp.json()


# ---------- STEP 6: likes ----------

def test_like_toggle_and_count():
    user_a_id, headers_a = _register_verified_user()
    user_b_id, headers_b = _register_verified_user()
    try:
        post = _create_post(headers_a)
        post_id = post["id"]

        resp = client.post(f"/api/v1/posts/{post_id}/like", headers=headers_a)
        assert resp.status_code == 200
        body = resp.json()
        assert body["liked"] is True
        assert body["like_count"] == 1

        resp = client.post(f"/api/v1/posts/{post_id}/like", headers=headers_b)
        body = resp.json()
        assert body["liked"] is True
        assert body["like_count"] == 2

        # A unlikes (toggle off)
        resp = client.post(f"/api/v1/posts/{post_id}/like", headers=headers_a)
        body = resp.json()
        assert body["liked"] is False
        assert body["like_count"] == 1

        resp = client.get(f"/api/v1/posts/{post_id}")
        assert resp.json()["like_count"] == 1
    finally:
        _cleanup_user(user_a_id)
        _cleanup_user(user_b_id)


def test_like_requires_auth():
    user_id, headers = _register_verified_user()
    try:
        post = _create_post(headers)
        
        # CRITICAL: Clear cookies to ensure this request is strictly unauthenticated
        client.cookies.clear()
        
        resp = client.post(f"/api/v1/posts/{post['id']}/like")
        assert resp.status_code == 401
    finally:
        _cleanup_user(user_id)


def test_like_nonexistent_post_404():
    user_id, headers = _register_verified_user()
    try:
        resp = client.post(f"/api/v1/posts/{uuid.uuid4()}/like", headers=headers)
        assert resp.status_code == 404
    finally:
        _cleanup_user(user_id)


# ---------- STEP 7: comments ----------

def test_comments_create_list_and_count_sync():
    user_a_id, headers_a = _register_verified_user()
    user_b_id, headers_b = _register_verified_user()
    try:
        post = _create_post(headers_a)
        post_id = post["id"]

        client.post(f"/api/v1/posts/{post_id}/comments", json={"content": "comment by the post author"}, headers=headers_a)
        client.post(f"/api/v1/posts/{post_id}/comments", json={"content": "comment by another user"}, headers=headers_b)

        resp = client.get(f"/api/v1/posts/{post_id}/comments")
        assert resp.status_code == 200
        assert len(resp.json()) == 2

        resp = client.get(f"/api/v1/posts/{post_id}")
        assert resp.json()["comment_count"] == 2
    finally:
        _cleanup_user(user_a_id)
        _cleanup_user(user_b_id)


def test_comment_delete_moderation_rules():
    """Post owner can delete anyone's comment on their post; a non-owner, non-author cannot."""
    user_a_id, headers_a = _register_verified_user()
    user_b_id, headers_b = _register_verified_user()
    try:
        post = _create_post(headers_a)
        post_id = post["id"]

        comment_a = client.post(
            f"/api/v1/posts/{post_id}/comments", json={"content": "author's own comment"}, headers=headers_a
        ).json()
        comment_b = client.post(
            f"/api/v1/posts/{post_id}/comments", json={"content": "another user's comment"}, headers=headers_b
        ).json()

        # Post owner (A) can delete B's comment (moderation rule)
        resp = client.delete(f"/api/v1/comments/{comment_b['id']}", headers=headers_a)
        assert resp.status_code == 204

        # B is neither the post owner nor the comment author here, so B cannot delete A's comment
        resp = client.delete(f"/api/v1/comments/{comment_a['id']}", headers=headers_b)
        assert resp.status_code == 403

        resp = client.get(f"/api/v1/posts/{post_id}")
        assert resp.json()["comment_count"] == 1
    finally:
        _cleanup_user(user_a_id)
        _cleanup_user(user_b_id)


def test_comment_author_can_delete_own_comment():
    user_a_id, headers_a = _register_verified_user()
    user_b_id, headers_b = _register_verified_user()
    try:
        post = _create_post(headers_a)
        post_id = post["id"]

        comment_b = client.post(
            f"/api/v1/posts/{post_id}/comments", json={"content": "my own comment"}, headers=headers_b
        ).json()

        resp = client.delete(f"/api/v1/comments/{comment_b['id']}", headers=headers_b)
        assert resp.status_code == 204
    finally:
        _cleanup_user(user_a_id)
        _cleanup_user(user_b_id)


# ---------- STEP 8: sharing ----------

def test_share_creates_reference_and_increments_count():
    user_a_id, headers_a = _register_verified_user()
    user_b_id, headers_b = _register_verified_user()
    try:
        post = _create_post(headers_a)
        post_id = post["id"]

        resp = client.post(
            f"/api/v1/posts/{post_id}/share", json={"caption": "check this out"}, headers=headers_b
        )
        assert resp.status_code == 201
        share = resp.json()
        assert share["original_post_id"] == post_id
        assert share["original_content"] == post["content"]

        resp = client.get(f"/api/v1/posts/{post_id}")
        assert resp.json()["share_count"] == 1

        # Share shows up on the sharer's own profile
        resp = client.get("/api/v1/users/me/profile", headers=headers_b)
        assert any(p["id"] == share["id"] for p in resp.json()["posts"])
    finally:
        _cleanup_user(user_a_id)
        _cleanup_user(user_b_id)


def test_share_survives_original_post_deletion():
    user_a_id, headers_a = _register_verified_user()
    user_b_id, headers_b = _register_verified_user()
    try:
        post = _create_post(headers_a)
        post_id = post["id"]

        share = client.post(
            f"/api/v1/posts/{post_id}/share", json={"caption": "before deletion"}, headers=headers_b
        ).json()

        resp = client.delete(f"/api/v1/posts/{post_id}", headers=headers_a)
        assert resp.status_code == 204

        # Share still loads without crashing even though the original is gone
        resp = client.get(f"/api/v1/posts/{share['id']}")
        assert resp.status_code == 200
        body = resp.json()
        
        # Verify that the shared post itself was successfully retrieved
        assert body["id"] == share["id"]
    finally:
        _cleanup_user(user_a_id)
        _cleanup_user(user_b_id)