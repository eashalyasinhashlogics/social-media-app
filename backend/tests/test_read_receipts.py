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
from app.models.message_read import MessageRead

client = TestClient(app)


async def _fake_send_otp_email(email, otp_code):
    """Stand-in for the real SMTP call so registration doesn't hit a live mail server."""
    return None


def _register_verified_user():
    email = f"read_{uuid.uuid4().hex[:8]}@example.com"
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
    try:
        conv_ids = [
            row[0] for row in
            db.query(ConversationParticipant.conversation_id).filter(ConversationParticipant.user_id == user_id).all()
        ]
        if conv_ids:
            # Same FK-ordering fix as test_conversations.py: null out the
            # conversation's pointer to its last message before deleting
            # any messages, or the delete below violates the FK.
            db.query(Conversation).filter(Conversation.id.in_(conv_ids)).update(
                {"last_message_id": None}, synchronize_session=False
            )
            db.flush()

            message_ids = [row[0] for row in db.query(Message.id).filter(Message.conversation_id.in_(conv_ids)).all()]
            if message_ids:
                db.query(MessageRead).filter(MessageRead.message_id.in_(message_ids)).delete(synchronize_session=False)
            db.query(Message).filter(Message.conversation_id.in_(conv_ids)).delete(synchronize_session=False)
            db.query(ConversationParticipant).filter(ConversationParticipant.conversation_id.in_(conv_ids)).delete(synchronize_session=False)
            db.query(Conversation).filter(Conversation.id.in_(conv_ids)).delete(synchronize_session=False)

        db.query(UserProfile).filter(UserProfile.user_id == user_id).delete()
        db.query(User).filter(User.id == user_id).delete()
        db.commit()
    finally:
        db.close()


def _start_conversation(headers_a, other_user_id):
    resp = client.post("/api/v1/conversations", json={"user_id": str(other_user_id)}, headers=headers_a)
    assert resp.status_code == 201
    return resp.json()["id"]


def _send(conversation_id, headers, content):
    resp = client.post(f"/api/v1/conversations/{conversation_id}/messages", json={"content": content}, headers=headers)
    assert resp.status_code == 201
    return resp.json()


# ---------- unread counts ----------

def test_unread_count_increases_with_each_message_from_other_user():
    user_a_id, headers_a = _register_verified_user()
    user_b_id, headers_b = _register_verified_user()
    try:
        conversation_id = _start_conversation(headers_a, user_b_id)

        resp = client.get(f"/api/v1/conversations/{conversation_id}/unread-count", headers=headers_b)
        assert resp.json()["unread_count"] == 0

        _send(conversation_id, headers_a, "one")
        resp = client.get(f"/api/v1/conversations/{conversation_id}/unread-count", headers=headers_b)
        assert resp.json()["unread_count"] == 1

        _send(conversation_id, headers_a, "two")
        _send(conversation_id, headers_a, "three")
        resp = client.get(f"/api/v1/conversations/{conversation_id}/unread-count", headers=headers_b)
        assert resp.json()["unread_count"] == 3
    finally:
        _cleanup_user(user_a_id)
        _cleanup_user(user_b_id)


def test_own_messages_do_not_count_as_unread_for_sender():
    user_a_id, headers_a = _register_verified_user()
    user_b_id, headers_b = _register_verified_user()
    try:
        conversation_id = _start_conversation(headers_a, user_b_id)
        _send(conversation_id, headers_a, "hi B")

        resp = client.get(f"/api/v1/conversations/{conversation_id}/unread-count", headers=headers_a)
        assert resp.json()["unread_count"] == 0
    finally:
        _cleanup_user(user_a_id)
        _cleanup_user(user_b_id)


def test_unread_count_requires_participant():
    user_a_id, headers_a = _register_verified_user()
    user_b_id, headers_b = _register_verified_user()
    user_c_id, headers_c = _register_verified_user()
    try:
        conversation_id = _start_conversation(headers_a, user_b_id)

        resp = client.get(f"/api/v1/conversations/{conversation_id}/unread-count", headers=headers_c)
        assert resp.status_code == 403
    finally:
        _cleanup_user(user_a_id)
        _cleanup_user(user_b_id)
        _cleanup_user(user_c_id)


def test_unread_count_requires_auth():
    resp = client.get(f"/api/v1/conversations/{uuid.uuid4()}/unread-count")
    assert resp.status_code == 401


# ---------- marking read ----------

def test_marking_read_zeroes_out_unread_count():
    user_a_id, headers_a = _register_verified_user()
    user_b_id, headers_b = _register_verified_user()
    try:
        conversation_id = _start_conversation(headers_a, user_b_id)
        _send(conversation_id, headers_a, "one")
        _send(conversation_id, headers_a, "two")

        resp = client.post(f"/api/v1/conversations/{conversation_id}/read", headers=headers_b)
        assert resp.status_code == 200
        assert resp.json()["marked_read"] == 2

        resp = client.get(f"/api/v1/conversations/{conversation_id}/unread-count", headers=headers_b)
        assert resp.json()["unread_count"] == 0
    finally:
        _cleanup_user(user_a_id)
        _cleanup_user(user_b_id)


def test_marking_read_twice_is_idempotent():
    user_a_id, headers_a = _register_verified_user()
    user_b_id, headers_b = _register_verified_user()
    try:
        conversation_id = _start_conversation(headers_a, user_b_id)
        _send(conversation_id, headers_a, "only message")

        resp = client.post(f"/api/v1/conversations/{conversation_id}/read", headers=headers_b)
        assert resp.json()["marked_read"] == 1

        resp = client.post(f"/api/v1/conversations/{conversation_id}/read", headers=headers_b)
        assert resp.json()["marked_read"] == 0
    finally:
        _cleanup_user(user_a_id)
        _cleanup_user(user_b_id)


def test_marking_read_requires_participant():
    user_a_id, headers_a = _register_verified_user()
    user_b_id, headers_b = _register_verified_user()
    user_c_id, headers_c = _register_verified_user()
    try:
        conversation_id = _start_conversation(headers_a, user_b_id)

        resp = client.post(f"/api/v1/conversations/{conversation_id}/read", headers=headers_c)
        assert resp.status_code == 403
    finally:
        _cleanup_user(user_a_id)
        _cleanup_user(user_b_id)
        _cleanup_user(user_c_id)


def test_new_message_after_read_shows_up_as_unread_again():
    user_a_id, headers_a = _register_verified_user()
    user_b_id, headers_b = _register_verified_user()
    try:
        conversation_id = _start_conversation(headers_a, user_b_id)
        _send(conversation_id, headers_a, "one")
        client.post(f"/api/v1/conversations/{conversation_id}/read", headers=headers_b)

        _send(conversation_id, headers_a, "two, after read")
        resp = client.get(f"/api/v1/conversations/{conversation_id}/unread-count", headers=headers_b)
        assert resp.json()["unread_count"] == 1
    finally:
        _cleanup_user(user_a_id)
        _cleanup_user(user_b_id)


# ---------- unread_count surfaced on the conversation list ----------

def test_conversation_list_includes_unread_count():
    user_a_id, headers_a = _register_verified_user()
    user_b_id, headers_b = _register_verified_user()
    try:
        conversation_id = _start_conversation(headers_a, user_b_id)
        _send(conversation_id, headers_a, "one")
        _send(conversation_id, headers_a, "two")

        resp = client.get("/api/v1/conversations", headers=headers_b)
        conv = next(c for c in resp.json() if c["id"] == conversation_id)
        assert conv["unread_count"] == 2

        client.post(f"/api/v1/conversations/{conversation_id}/read", headers=headers_b)

        resp = client.get("/api/v1/conversations", headers=headers_b)
        conv = next(c for c in resp.json() if c["id"] == conversation_id)
        assert conv["unread_count"] == 0
    finally:
        _cleanup_user(user_a_id)
        _cleanup_user(user_b_id)