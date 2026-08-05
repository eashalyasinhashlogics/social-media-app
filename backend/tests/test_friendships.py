import uuid
from unittest.mock import patch
from fastapi.testclient import TestClient
from app.main import app
from app.db.database import SessionLocal
from app.models.user import User
from app.models.user_profile import UserProfile
from app.models.friend_request import FriendRequest
from app.models.friendship import Friendship

client = TestClient(app)


async def _fake_send_otp_email(email, otp_code):
    """Stand-in for the real SMTP call so registration doesn't hit a live mail server."""
    return None


def _register_verified_user():
    """Register a user, mark them verified, log in, and return (user_id, auth_headers)."""
    email = f"fship_{uuid.uuid4().hex[:8]}@example.com"
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
    db.query(Friendship).filter(
        (Friendship.user1_id == user_id) | (Friendship.user2_id == user_id)
    ).delete(synchronize_session=False)
    db.query(FriendRequest).filter(
        (FriendRequest.from_user_id == user_id) | (FriendRequest.to_user_id == user_id)
    ).delete(synchronize_session=False)
    db.query(UserProfile).filter(UserProfile.user_id == user_id).delete()
    db.query(User).filter(User.id == user_id).delete()
    db.commit()
    db.close()


def _become_friends(headers_a, user_b_id, headers_b):
    resp = client.post("/api/v1/friend-requests", json={"to_user_id": str(user_b_id)}, headers=headers_a)
    request_id = resp.json()["id"]
    resp = client.post(f"/api/v1/friend-requests/{request_id}/accept", headers=headers_b)
    assert resp.status_code == 200


def test_friends_list_symmetric_after_accept():
    user_a_id, headers_a = _register_verified_user()
    user_b_id, headers_b = _register_verified_user()
    try:
        _become_friends(headers_a, user_b_id, headers_b)

        resp = client.get("/api/v1/friends", headers=headers_a)
        assert resp.status_code == 200
        assert any(f["friend"]["id"] == str(user_b_id) for f in resp.json())

        resp = client.get("/api/v1/friends", headers=headers_b)
        assert resp.status_code == 200
        assert any(f["friend"]["id"] == str(user_a_id) for f in resp.json())
    finally:
        _cleanup_user(user_a_id)
        _cleanup_user(user_b_id)


def test_friends_list_requires_auth():
    resp = client.get("/api/v1/friends")
    assert resp.status_code == 401


def test_friends_list_empty_for_new_user():
    user_id, headers = _register_verified_user()
    try:
        resp = client.get("/api/v1/friends", headers=headers)
        assert resp.status_code == 200
        assert resp.json() == []
    finally:
        _cleanup_user(user_id)


def test_unfriend_removes_relationship_both_ways():
    user_a_id, headers_a = _register_verified_user()
    user_b_id, headers_b = _register_verified_user()
    try:
        _become_friends(headers_a, user_b_id, headers_b)

        resp = client.delete(f"/api/v1/friends/{user_b_id}", headers=headers_a)
        assert resp.status_code == 204

        resp = client.get("/api/v1/friends", headers=headers_a)
        assert resp.json() == []

        resp = client.get("/api/v1/friends", headers=headers_b)
        assert resp.json() == []
    finally:
        _cleanup_user(user_a_id)
        _cleanup_user(user_b_id)


def test_unfriend_when_not_friends_404():
    user_a_id, headers_a = _register_verified_user()
    user_b_id, headers_b = _register_verified_user()
    try:
        resp = client.delete(f"/api/v1/friends/{user_b_id}", headers=headers_a)
        assert resp.status_code == 404
    finally:
        _cleanup_user(user_a_id)
        _cleanup_user(user_b_id)


def test_unfriend_then_re_request_works():
    user_a_id, headers_a = _register_verified_user()
    user_b_id, headers_b = _register_verified_user()
    try:
        _become_friends(headers_a, user_b_id, headers_b)
        client.delete(f"/api/v1/friends/{user_b_id}", headers=headers_a)

        # Should be able to send a fresh request after unfriending
        resp = client.post("/api/v1/friend-requests", json={"to_user_id": str(user_b_id)}, headers=headers_a)
        assert resp.status_code == 201
    finally:
        _cleanup_user(user_a_id)
        _cleanup_user(user_b_id)