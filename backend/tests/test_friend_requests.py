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
    email = f"freq_{uuid.uuid4().hex[:8]}@example.com"
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


# ---------- send / list ----------

def test_send_and_list_incoming_outgoing():
    user_a_id, headers_a = _register_verified_user()
    user_b_id, headers_b = _register_verified_user()
    try:
        resp = client.post("/api/v1/friend-requests", json={"to_user_id": str(user_b_id)}, headers=headers_a)
        assert resp.status_code == 201
        body = resp.json()
        assert body["from_user_id"] == str(user_a_id)
        assert body["to_user_id"] == str(user_b_id)
        assert body["status"] == "pending"

        resp = client.get("/api/v1/friend-requests?direction=incoming", headers=headers_b)
        assert resp.status_code == 200
        assert any(r["from_user_id"] == str(user_a_id) for r in resp.json())

        resp = client.get("/api/v1/friend-requests?direction=outgoing", headers=headers_a)
        assert resp.status_code == 200
        assert any(r["to_user_id"] == str(user_b_id) for r in resp.json())
    finally:
        _cleanup_user(user_a_id)
        _cleanup_user(user_b_id)


def test_send_requires_auth():
    resp = client.post("/api/v1/friend-requests", json={"to_user_id": str(uuid.uuid4())})
    assert resp.status_code == 401


def test_self_request_rejected():
    user_id, headers = _register_verified_user()
    try:
        resp = client.post("/api/v1/friend-requests", json={"to_user_id": str(user_id)}, headers=headers)
        assert resp.status_code == 400
    finally:
        _cleanup_user(user_id)


def test_request_to_nonexistent_user_404():
    user_id, headers = _register_verified_user()
    try:
        resp = client.post("/api/v1/friend-requests", json={"to_user_id": str(uuid.uuid4())}, headers=headers)
        assert resp.status_code == 404
    finally:
        _cleanup_user(user_id)


def test_duplicate_pending_request_rejected():
    user_a_id, headers_a = _register_verified_user()
    user_b_id, headers_b = _register_verified_user()
    try:
        resp = client.post("/api/v1/friend-requests", json={"to_user_id": str(user_b_id)}, headers=headers_a)
        assert resp.status_code == 201

        # A sending to B again
        resp = client.post("/api/v1/friend-requests", json={"to_user_id": str(user_b_id)}, headers=headers_a)
        assert resp.status_code == 409

        # B sending to A while A's request is still pending is also blocked
        resp = client.post("/api/v1/friend-requests", json={"to_user_id": str(user_a_id)}, headers=headers_b)
        assert resp.status_code == 409
    finally:
        _cleanup_user(user_a_id)
        _cleanup_user(user_b_id)


# ---------- accept / reject / cancel ----------

def test_accept_request_creates_friendship_and_clears_pending():
    user_a_id, headers_a = _register_verified_user()
    user_b_id, headers_b = _register_verified_user()
    try:
        resp = client.post("/api/v1/friend-requests", json={"to_user_id": str(user_b_id)}, headers=headers_a)
        request_id = resp.json()["id"]

        resp = client.post(f"/api/v1/friend-requests/{request_id}/accept", headers=headers_b)
        assert resp.status_code == 200
        assert resp.json()["status"] == "accepted"

        # No longer pending for either side
        resp = client.get("/api/v1/friend-requests?direction=incoming", headers=headers_b)
        assert all(r["id"] != request_id for r in resp.json())

        resp = client.get("/api/v1/friends", headers=headers_a)
        assert resp.status_code == 200
        assert any(f["friend"]["id"] == str(user_b_id) for f in resp.json())
    finally:
        _cleanup_user(user_a_id)
        _cleanup_user(user_b_id)


def test_only_recipient_can_accept():
    user_a_id, headers_a = _register_verified_user()
    user_b_id, headers_b = _register_verified_user()
    user_c_id, headers_c = _register_verified_user()
    try:
        resp = client.post("/api/v1/friend-requests", json={"to_user_id": str(user_b_id)}, headers=headers_a)
        request_id = resp.json()["id"]

        # C is neither sender nor recipient
        resp = client.post(f"/api/v1/friend-requests/{request_id}/accept", headers=headers_c)
        assert resp.status_code == 403

        # The sender can't accept their own request either
        resp = client.post(f"/api/v1/friend-requests/{request_id}/accept", headers=headers_a)
        assert resp.status_code == 403
    finally:
        _cleanup_user(user_a_id)
        _cleanup_user(user_b_id)
        _cleanup_user(user_c_id)


def test_reject_request():
    user_a_id, headers_a = _register_verified_user()
    user_b_id, headers_b = _register_verified_user()
    try:
        resp = client.post("/api/v1/friend-requests", json={"to_user_id": str(user_b_id)}, headers=headers_a)
        request_id = resp.json()["id"]

        resp = client.post(f"/api/v1/friend-requests/{request_id}/reject", headers=headers_b)
        assert resp.status_code == 200
        assert resp.json()["status"] == "rejected"

        resp = client.get("/api/v1/friends", headers=headers_a)
        assert resp.json() == []
    finally:
        _cleanup_user(user_a_id)
        _cleanup_user(user_b_id)


def test_cancel_request_by_sender():
    user_a_id, headers_a = _register_verified_user()
    user_b_id, headers_b = _register_verified_user()
    try:
        resp = client.post("/api/v1/friend-requests", json={"to_user_id": str(user_b_id)}, headers=headers_a)
        request_id = resp.json()["id"]

        # Recipient cannot cancel
        resp = client.delete(f"/api/v1/friend-requests/{request_id}", headers=headers_b)
        assert resp.status_code == 403

        # Sender can cancel
        resp = client.delete(f"/api/v1/friend-requests/{request_id}", headers=headers_a)
        assert resp.status_code == 204

        resp = client.get("/api/v1/friend-requests?direction=incoming", headers=headers_b)
        assert resp.json() == []
    finally:
        _cleanup_user(user_a_id)
        _cleanup_user(user_b_id)


def test_cannot_act_on_already_resolved_request():
    user_a_id, headers_a = _register_verified_user()
    user_b_id, headers_b = _register_verified_user()
    try:
        resp = client.post("/api/v1/friend-requests", json={"to_user_id": str(user_b_id)}, headers=headers_a)
        request_id = resp.json()["id"]

        client.post(f"/api/v1/friend-requests/{request_id}/accept", headers=headers_b)

        # Already accepted - rejecting/cancelling now should 400
        resp = client.post(f"/api/v1/friend-requests/{request_id}/reject", headers=headers_b)
        assert resp.status_code == 400

        resp = client.delete(f"/api/v1/friend-requests/{request_id}", headers=headers_a)
        assert resp.status_code == 400
    finally:
        _cleanup_user(user_a_id)
        _cleanup_user(user_b_id)


def test_accept_nonexistent_request_404():
    user_id, headers = _register_verified_user()
    try:
        resp = client.post(f"/api/v1/friend-requests/{uuid.uuid4()}/accept", headers=headers)
        assert resp.status_code == 404
    finally:
        _cleanup_user(user_id)


def test_cannot_request_someone_already_friends_with():
    user_a_id, headers_a = _register_verified_user()
    user_b_id, headers_b = _register_verified_user()
    try:
        resp = client.post("/api/v1/friend-requests", json={"to_user_id": str(user_b_id)}, headers=headers_a)
        request_id = resp.json()["id"]
        client.post(f"/api/v1/friend-requests/{request_id}/accept", headers=headers_b)

        # Already friends - a fresh request should be rejected as a conflict
        resp = client.post("/api/v1/friend-requests", json={"to_user_id": str(user_b_id)}, headers=headers_a)
        assert resp.status_code == 409
    finally:
        _cleanup_user(user_a_id)
        _cleanup_user(user_b_id)