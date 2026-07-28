import uuid
from unittest.mock import patch
from fastapi.testclient import TestClient
from app.main import app
from app.db.database import SessionLocal
from app.models.user import User
from app.models.user_profile import UserProfile
from app.models.follow import Follow

client = TestClient(app)


async def _fake_send_otp_email(email, otp_code):
    """Stand-in for the real SMTP call so registration doesn't hit a live mail server."""
    return None


def _register_verified_user():
    """Register a user, mark them verified, log in, and return (user_id, auth_headers)."""
    email = f"follow_{uuid.uuid4().hex[:8]}@example.com"
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


def _get_counts(user_id):
    db = SessionLocal()
    profile = db.query(UserProfile).filter(UserProfile.user_id == user_id).first()
    counts = (profile.follower_count, profile.following_count) if profile else (0, 0)
    db.close()
    return counts


def _cleanup_user(user_id):
    db = SessionLocal()
    db.query(Follow).filter(
        (Follow.follower_id == user_id) | (Follow.following_id == user_id)
    ).delete(synchronize_session=False)
    db.query(UserProfile).filter(UserProfile.user_id == user_id).delete()
    db.query(User).filter(User.id == user_id).delete()
    db.commit()
    db.close()


# ---------- follow / unfollow ----------

def test_follow_and_unfollow():
    user_a_id, headers_a = _register_verified_user()
    user_b_id, headers_b = _register_verified_user()
    try:
        resp = client.post(f"/api/v1/users/{user_b_id}/follow", headers=headers_a)
        assert resp.status_code == 201
        body = resp.json()
        assert body["following"] is True
        assert body["follower_count"] == 1

        _, a_following_count = _get_counts(user_a_id)
        b_follower_count, _ = _get_counts(user_b_id)
        assert a_following_count == 1
        assert b_follower_count == 1

        resp = client.delete(f"/api/v1/users/{user_b_id}/follow", headers=headers_a)
        assert resp.status_code == 200
        assert resp.json()["following"] is False

        _, a_following_count = _get_counts(user_a_id)
        b_follower_count, _ = _get_counts(user_b_id)
        assert a_following_count == 0
        assert b_follower_count == 0
    finally:
        _cleanup_user(user_a_id)
        _cleanup_user(user_b_id)


def test_follow_requires_auth():
    resp = client.post(f"/api/v1/users/{uuid.uuid4()}/follow")
    assert resp.status_code == 401


def test_duplicate_follow_returns_409():
    user_a_id, headers_a = _register_verified_user()
    user_b_id, _ = _register_verified_user()
    try:
        resp = client.post(f"/api/v1/users/{user_b_id}/follow", headers=headers_a)
        assert resp.status_code == 201

        resp = client.post(f"/api/v1/users/{user_b_id}/follow", headers=headers_a)
        assert resp.status_code == 409
    finally:
        _cleanup_user(user_a_id)
        _cleanup_user(user_b_id)


def test_unfollow_when_not_following_returns_404():
    user_a_id, headers_a = _register_verified_user()
    user_b_id, _ = _register_verified_user()
    try:
        resp = client.delete(f"/api/v1/users/{user_b_id}/follow", headers=headers_a)
        assert resp.status_code == 404
    finally:
        _cleanup_user(user_a_id)
        _cleanup_user(user_b_id)


def test_self_follow_rejected():
    user_a_id, headers_a = _register_verified_user()
    try:
        resp = client.post(f"/api/v1/users/{user_a_id}/follow", headers=headers_a)
        assert resp.status_code == 400
    finally:
        _cleanup_user(user_a_id)


def test_follow_nonexistent_user_404():
    user_a_id, headers_a = _register_verified_user()
    try:
        resp = client.post(f"/api/v1/users/{uuid.uuid4()}/follow", headers=headers_a)
        assert resp.status_code == 404
    finally:
        _cleanup_user(user_a_id)


# ---------- followers / following lists ----------

def test_followers_and_following_lists():
    user_a_id, headers_a = _register_verified_user()
    user_b_id, headers_b = _register_verified_user()
    user_c_id, headers_c = _register_verified_user()
    try:
        # A follows B, C follows B -> B has 2 followers
        client.post(f"/api/v1/users/{user_b_id}/follow", headers=headers_a)
        client.post(f"/api/v1/users/{user_b_id}/follow", headers=headers_c)
        # B follows A -> A has 1 follower, B is following 1
        client.post(f"/api/v1/users/{user_a_id}/follow", headers=headers_b)

        resp = client.get(f"/api/v1/users/{user_b_id}/followers")
        assert resp.status_code == 200
        follower_ids = {f["id"] for f in resp.json()}
        assert follower_ids == {str(user_a_id), str(user_c_id)}

        resp = client.get(f"/api/v1/users/{user_b_id}/following")
        assert resp.status_code == 200
        following_ids = {f["id"] for f in resp.json()}
        assert following_ids == {str(user_a_id)}
    finally:
        _cleanup_user(user_a_id)
        _cleanup_user(user_b_id)
        _cleanup_user(user_c_id)


def test_followers_list_empty_for_new_user():
    user_id, _ = _register_verified_user()
    try:
        resp = client.get(f"/api/v1/users/{user_id}/followers")
        assert resp.status_code == 200
        assert resp.json() == []
    finally:
        _cleanup_user(user_id)


def test_followers_list_for_nonexistent_user_404():
    resp = client.get(f"/api/v1/users/{uuid.uuid4()}/followers")
    assert resp.status_code == 404