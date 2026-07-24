import uuid
from unittest.mock import patch
from fastapi.testclient import TestClient
from app.main import app
from app.db.database import SessionLocal
from app.models.user import User
from app.models.user_profile import UserProfile
from app.models.conversation import Conversation
from app.models.conversation_participant import ConversationParticipant
from app.models.message import Message

client = TestClient(app)


async def _fake_send_otp_email(email, otp_code):
    """Stand-in for the real SMTP call so registration doesn't hit a live mail server."""
    return None


def _register_verified_user():
    """Register a user, mark them verified, log in, and return (user_id, auth_headers)."""
    email = f"chat_{uuid.uuid4().hex[:8]}@example.com"
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
    conv_ids = [
        row[0] for row in
        db.query(ConversationParticipant.conversation_id).filter(ConversationParticipant.user_id == user_id).all()
    ]
    if conv_ids:
        db.query(Message).filter(Message.conversation_id.in_(conv_ids)).delete(synchronize_session=False)
        db.query(ConversationParticipant).filter(ConversationParticipant.conversation_id.in_(conv_ids)).delete(synchronize_session=False)
        db.query(Conversation).filter(Conversation.id.in_(conv_ids)).delete(synchronize_session=False)
    db.query(UserProfile).filter(UserProfile.user_id == user_id).delete()
    db.query(User).filter(User.id == user_id).delete()
    db.commit()
    db.close()


# ---------- starting a conversation ----------

def test_start_conversation_creates_and_dedupes():
    user_a_id, headers_a = _register_verified_user()
    user_b_id, headers_b = _register_verified_user()
    try:
        resp = client.post("/api/v1/conversations", json={"user_id": str(user_b_id)}, headers=headers_a)
        assert resp.status_code == 201
        conversation_id = resp.json()["id"]
        assert set(resp.json()["participant_ids"]) == {str(user_a_id), str(user_b_id)}

        # Starting again (either direction) should return the same conversation
        resp = client.post("/api/v1/conversations", json={"user_id": str(user_a_id)}, headers=headers_b)
        assert resp.status_code == 201
        assert resp.json()["id"] == conversation_id
    finally:
        _cleanup_user(user_a_id)
        _cleanup_user(user_b_id)


def test_start_conversation_requires_auth():
    resp = client.post("/api/v1/conversations", json={"user_id": str(uuid.uuid4())})
    assert resp.status_code == 401


def test_cannot_start_conversation_with_self():
    user_id, headers = _register_verified_user()
    try:
        resp = client.post("/api/v1/conversations", json={"user_id": str(user_id)}, headers=headers)
        assert resp.status_code == 400
    finally:
        _cleanup_user(user_id)


def test_start_conversation_with_nonexistent_user_404():
    user_id, headers = _register_verified_user()
    try:
        resp = client.post("/api/v1/conversations", json={"user_id": str(uuid.uuid4())}, headers=headers)
        assert resp.status_code == 404
    finally:
        _cleanup_user(user_id)


def test_list_conversations_only_shows_own():
    user_a_id, headers_a = _register_verified_user()
    user_b_id, headers_b = _register_verified_user()
    user_c_id, headers_c = _register_verified_user()
    try:
        client.post("/api/v1/conversations", json={"user_id": str(user_b_id)}, headers=headers_a)

        resp = client.get("/api/v1/conversations", headers=headers_a)
        assert resp.status_code == 200
        assert len(resp.json()) == 1

        resp = client.get("/api/v1/conversations", headers=headers_c)
        assert resp.json() == []
    finally:
        _cleanup_user(user_a_id)
        _cleanup_user(user_b_id)
        _cleanup_user(user_c_id)


# ---------- messages ----------

def test_send_and_list_messages():
    user_a_id, headers_a = _register_verified_user()
    user_b_id, headers_b = _register_verified_user()
    try:
        resp = client.post("/api/v1/conversations", json={"user_id": str(user_b_id)}, headers=headers_a)
        conversation_id = resp.json()["id"]

        resp = client.post(
            f"/api/v1/conversations/{conversation_id}/messages",
            json={"content": "hey there"},
            headers=headers_a,
        )
        assert resp.status_code == 201
        assert resp.json()["content"] == "hey there"
        assert resp.json()["sender_id"] == str(user_a_id)

        resp = client.post(
            f"/api/v1/conversations/{conversation_id}/messages",
            json={"content": "hi back"},
            headers=headers_b,
        )
        assert resp.status_code == 201

        resp = client.get(f"/api/v1/conversations/{conversation_id}/messages", headers=headers_a)
        assert resp.status_code == 200
        contents = {m["content"] for m in resp.json()}
        assert contents == {"hey there", "hi back"}
    finally:
        _cleanup_user(user_a_id)
        _cleanup_user(user_b_id)


def test_non_participant_cannot_read_or_send_messages():
    user_a_id, headers_a = _register_verified_user()
    user_b_id, headers_b = _register_verified_user()
    user_c_id, headers_c = _register_verified_user()
    try:
        resp = client.post("/api/v1/conversations", json={"user_id": str(user_b_id)}, headers=headers_a)
        conversation_id = resp.json()["id"]

        resp = client.get(f"/api/v1/conversations/{conversation_id}/messages", headers=headers_c)
        assert resp.status_code == 403

        resp = client.post(
            f"/api/v1/conversations/{conversation_id}/messages",
            json={"content": "sneaking in"},
            headers=headers_c,
        )
        assert resp.status_code == 403
    finally:
        _cleanup_user(user_a_id)
        _cleanup_user(user_b_id)
        _cleanup_user(user_c_id)


def test_message_to_nonexistent_conversation_404():
    user_id, headers = _register_verified_user()
    try:
        resp = client.get(f"/api/v1/conversations/{uuid.uuid4()}/messages", headers=headers)
        assert resp.status_code == 404

        resp = client.post(
            f"/api/v1/conversations/{uuid.uuid4()}/messages",
            json={"content": "hello"},
            headers=headers,
        )
        assert resp.status_code == 404
    finally:
        _cleanup_user(user_id)


def test_conversation_last_message_updates_after_send():
    user_a_id, headers_a = _register_verified_user()
    user_b_id, headers_b = _register_verified_user()
    try:
        resp = client.post("/api/v1/conversations", json={"user_id": str(user_b_id)}, headers=headers_a)
        conversation_id = resp.json()["id"]
        assert resp.json()["last_message"] is None

        client.post(
            f"/api/v1/conversations/{conversation_id}/messages",
            json={"content": "first message"},
            headers=headers_a,
        )

        resp = client.get("/api/v1/conversations", headers=headers_a)
        conv = next(c for c in resp.json() if c["id"] == conversation_id)
        assert conv["last_message"]["content"] == "first message"
        assert conv["last_message_at"] is not None
    finally:
        _cleanup_user(user_a_id)
        _cleanup_user(user_b_id)


def test_messages_pagination():
    user_a_id, headers_a = _register_verified_user()
    user_b_id, headers_b = _register_verified_user()
    try:
        resp = client.post("/api/v1/conversations", json={"user_id": str(user_b_id)}, headers=headers_a)
        conversation_id = resp.json()["id"]

        for i in range(5):
            client.post(
                f"/api/v1/conversations/{conversation_id}/messages",
                json={"content": f"message {i}"},
                headers=headers_a,
            )

        resp = client.get(f"/api/v1/conversations/{conversation_id}/messages?skip=0&limit=2", headers=headers_a)
        assert resp.status_code == 200
        assert len(resp.json()) == 2

        resp = client.get(f"/api/v1/conversations/{conversation_id}/messages?skip=2&limit=2", headers=headers_a)
        assert len(resp.json()) == 2
    finally:
        _cleanup_user(user_a_id)
        _cleanup_user(user_b_id)