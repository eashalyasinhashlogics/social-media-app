import uuid
from unittest.mock import patch
from fastapi.testclient import TestClient
from starlette.websockets import WebSocketDisconnect
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
    """Register a user, mark them verified, log in, and return (user_id, token, auth_headers)."""
    email = f"ws_{uuid.uuid4().hex[:8]}@example.com"
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

    return user_id, token, {"Authorization": f"Bearer {token}"}


def _cleanup_user(user_id):
    db = SessionLocal()
    try:
        conv_ids = [
            row[0] for row in
            db.query(ConversationParticipant.conversation_id).filter(ConversationParticipant.user_id == user_id).all()
        ]
        if conv_ids:
            # conversations.last_message_id points at a row in messages -
            # clear that reference FIRST, or the DELETE FROM messages below
            # violates the FK (the "ON DELETE SET NULL" on the constraint
            # only helps when Postgres itself cascades an update; a plain
            # bulk DELETE here still needs the referencing column cleared
            # by us before the referenced row can go).
            db.query(Conversation).filter(Conversation.id.in_(conv_ids)).update(
                {"last_message_id": None}, synchronize_session=False
            )
            db.flush()

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


# ---------- auth ----------

def test_websocket_rejects_missing_token():
    try:
        with client.websocket_connect("/ws/chat"):
            pass
        assert False, "expected the handshake to be rejected"
    except WebSocketDisconnect:
        pass


def test_websocket_rejects_invalid_token():
    try:
        with client.websocket_connect("/ws/chat?token=not-a-real-token"):
            pass
        assert False, "expected the handshake to be rejected"
    except WebSocketDisconnect:
        pass


# ---------- happy path ----------

def test_send_message_broadcasts_to_other_participant():
    user_a_id, token_a, headers_a = _register_verified_user()
    user_b_id, token_b, headers_b = _register_verified_user()
    try:
        conversation_id = _start_conversation(headers_a, user_b_id)

        with client.websocket_connect(f"/ws/chat?token={token_a}") as ws_a:
            with client.websocket_connect(f"/ws/chat?token={token_b}") as ws_b:
                ws_a.send_json({"conversation_id": conversation_id, "content": "hello from A"})

                frame_a = ws_a.receive_json()  # sender also gets the broadcast
                frame_b = ws_b.receive_json()

                assert frame_a["type"] == "message"
                assert frame_a["content"] == "hello from A"
                assert frame_b["content"] == "hello from A"
                assert frame_b["sender_id"] == str(user_a_id)
    finally:
        _cleanup_user(user_a_id)
        _cleanup_user(user_b_id)


def test_message_persists_and_is_retrievable_via_rest_after_disconnect():
    user_a_id, token_a, headers_a = _register_verified_user()
    user_b_id, token_b, headers_b = _register_verified_user()
    try:
        conversation_id = _start_conversation(headers_a, user_b_id)

        with client.websocket_connect(f"/ws/chat?token={token_a}") as ws_a:
            ws_a.send_json({"conversation_id": conversation_id, "content": "will this survive a disconnect?"})
            ws_a.receive_json()
        # socket is now closed (exited the `with` block)

        resp = client.get(f"/api/v1/conversations/{conversation_id}/messages", headers=headers_a)
        assert resp.status_code == 200
        contents = [m["content"] for m in resp.json()]
        assert "will this survive a disconnect?" in contents
    finally:
        _cleanup_user(user_a_id)
        _cleanup_user(user_b_id)


def test_conversation_last_message_updates_via_websocket():
    user_a_id, token_a, headers_a = _register_verified_user()
    user_b_id, token_b, headers_b = _register_verified_user()
    try:
        conversation_id = _start_conversation(headers_a, user_b_id)

        with client.websocket_connect(f"/ws/chat?token={token_a}") as ws_a:
            ws_a.send_json({"conversation_id": conversation_id, "content": "updates last_message too"})
            ws_a.receive_json()

        resp = client.get("/api/v1/conversations", headers=headers_a)
        conv = next(c for c in resp.json() if c["id"] == conversation_id)
        assert conv["last_message"]["content"] == "updates last_message too"
    finally:
        _cleanup_user(user_a_id)
        _cleanup_user(user_b_id)


# ---------- rejection ----------

def test_non_participant_gets_error_frame_and_message_not_persisted():
    user_a_id, token_a, headers_a = _register_verified_user()
    user_b_id, token_b, headers_b = _register_verified_user()
    user_c_id, token_c, headers_c = _register_verified_user()
    try:
        conversation_id = _start_conversation(headers_a, user_b_id)

        with client.websocket_connect(f"/ws/chat?token={token_c}") as ws_c:
            ws_c.send_json({"conversation_id": conversation_id, "content": "sneaking in"})
            frame = ws_c.receive_json()
            assert frame["type"] == "error"

        resp = client.get(f"/api/v1/conversations/{conversation_id}/messages", headers=headers_a)
        contents = [m["content"] for m in resp.json()]
        assert "sneaking in" not in contents
    finally:
        _cleanup_user(user_a_id)
        _cleanup_user(user_b_id)
        _cleanup_user(user_c_id)


def test_malformed_frame_returns_error_without_closing():
    user_a_id, token_a, headers_a = _register_verified_user()
    user_b_id, token_b, headers_b = _register_verified_user()
    try:
        conversation_id = _start_conversation(headers_a, user_b_id)

        with client.websocket_connect(f"/ws/chat?token={token_a}") as ws_a:
            ws_a.send_json({"conversation_id": conversation_id})  # missing "content"
            frame = ws_a.receive_json()
            assert frame["type"] == "error"

            # connection still usable afterwards
            ws_a.send_json({"conversation_id": conversation_id, "content": "recovered fine"})
            frame2 = ws_a.receive_json()
            assert frame2["type"] == "message"
    finally:
        _cleanup_user(user_a_id)
        _cleanup_user(user_b_id)