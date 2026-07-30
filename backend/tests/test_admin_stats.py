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
from app.models.post_like import PostLike
from app.models.comment import Comment
from app.db.enums import UserRole, PostStatus

client = TestClient(app)


async def _fake_send_otp_email(email, otp_code):
    return None


def _register_verified_user(as_admin: bool = False):
    email = f"admin_stats_{uuid.uuid4().hex[:8]}@example.com"
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


def _baseline_totals(db):
    return {
        "total_users": db.query(User).filter(User.deleted_at.is_(None)).count(),
        "total_posts": db.query(Post).filter(Post.deleted_at.is_(None)).count(),
        "active_posts": db.query(Post).filter(
            Post.status == PostStatus.active, Post.deleted_at.is_(None)
        ).count(),
        "archived_posts": db.query(Post).filter(
            Post.status == PostStatus.archived, Post.deleted_at.is_(None)
        ).count(),
    }


def _cleanup(user_ids, post_ids):
    db = SessionLocal()
    if post_ids:
        db.query(PostLike).filter(PostLike.post_id.in_(post_ids)).delete(synchronize_session=False)
        db.query(Comment).filter(Comment.post_id.in_(post_ids)).delete(synchronize_session=False)
        db.query(Post).filter(Post.id.in_(post_ids)).delete(synchronize_session=False)
    for user_id in user_ids:
        db.query(UserSession).filter(UserSession.user_id == user_id).delete(synchronize_session=False)
        db.query(RefreshToken).filter(RefreshToken.user_id == user_id).delete(synchronize_session=False)
        db.query(UserProfile).filter(UserProfile.user_id == user_id).delete()
        db.query(User).filter(User.id == user_id).delete()
    db.commit()
    db.close()


def test_stats_totals_match_seed_data():
    db = SessionLocal()
    baseline = _baseline_totals(db)
    db.close()

    admin_id, admin_headers = _register_verified_user(as_admin=True)
    user_id, user_headers = _register_verified_user(as_admin=False)
    post_ids = []
    try:
        post_a = _create_post(user_headers, "post a")
        post_b = _create_post(user_headers, "post b")
        post_ids = [post_a, post_b]

        resp = client.patch(f"/api/v1/posts/{post_b}/archive", headers=user_headers)
        assert resp.status_code == 200

        resp = client.get("/api/v1/admin/stats", headers=admin_headers)
        assert resp.status_code == 200
        body = resp.json()

        assert body["total_users"] == baseline["total_users"] + 2
        assert body["total_posts"] == baseline["total_posts"] + 2
        assert body["active_posts"] == baseline["active_posts"] + 1
        assert body["archived_posts"] == baseline["archived_posts"] + 1
    finally:
        _cleanup([admin_id, user_id], post_ids)


def test_stats_engagement_counts_likes_and_comments():
    admin_id, admin_headers = _register_verified_user(as_admin=True)
    user_id, user_headers = _register_verified_user(as_admin=False)
    post_ids = []
    try:
        post_id = _create_post(user_headers, "likeable post")
        post_ids = [post_id]

        resp = client.post(f"/api/v1/posts/{post_id}/like", headers=admin_headers)
        assert resp.status_code == 200

        resp = client.post(
            f"/api/v1/posts/{post_id}/comments",
            json={"content": "nice post"},
            headers=admin_headers,
        )
        assert resp.status_code == 201

        resp = client.get("/api/v1/admin/stats", headers=admin_headers)
        assert resp.status_code == 200
        body = resp.json()

        total_likes = sum(d["count"] for d in body["likes_by_day"])
        total_comments = sum(d["count"] for d in body["comments_by_day"])
        assert total_likes >= 1
        assert total_comments >= 1
    finally:
        _cleanup([admin_id, user_id], post_ids)


def test_stats_requires_admin():
    user_id, headers = _register_verified_user(as_admin=False)
    try:
        resp = client.get("/api/v1/admin/stats", headers=headers)
        assert resp.status_code == 403
    finally:
        _cleanup([user_id], [])
