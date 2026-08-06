import uuid
from unittest.mock import patch
from fastapi.testclient import TestClient
from app.main import app
from app.db.database import SessionLocal
from app.models.user import User
from app.models.post import Post
from app.models.user_profile import UserProfile
from app.models.refresh_token import RefreshToken
from app.models.user_session import UserSession
from app.models.audit_log import AuditLog
from app.db.enums import UserRole, PostStatus

client = TestClient(app)


async def _fake_send_otp_email(email, otp_code):
    return None


def _register_verified_user(as_admin: bool = False):
    """Register a verified user and return (user_id, headers, email, password)."""
    email = f"audit_test_{uuid.uuid4().hex[:8]}@example.com"
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

    return user_id, {"Authorization": f"Bearer {token}"}, email, password


def _cleanup_user(user_id):
    """Clean up test user and related data."""
    db = SessionLocal()
    db.query(UserSession).filter(UserSession.user_id == user_id).delete(synchronize_session=False)
    db.query(RefreshToken).filter(RefreshToken.user_id == user_id).delete(synchronize_session=False)
    db.query(UserProfile).filter(UserProfile.user_id == user_id).delete()
    db.query(AuditLog).filter(AuditLog.admin_id == user_id).delete(synchronize_session=False)
    db.query(User).filter(User.id == user_id).delete()
    db.commit()
    db.close()


def test_admin_block_user_creates_audit_log():
    """Test that blocking a user creates an audit log entry."""
    admin_id, admin_headers, _, _ = _register_verified_user(as_admin=True)
    user_id, _, _, _ = _register_verified_user(as_admin=False)
    try:
        resp = client.post(f"/api/v1/admin/users/{user_id}/block", headers=admin_headers)
        assert resp.status_code == 200
        
        # Check audit log was created
        db = SessionLocal()
        log = db.query(AuditLog).filter(
            AuditLog.admin_id == admin_id,
            AuditLog.action == "user_block",
            AuditLog.entity_id == user_id,
        ).first()
        assert log is not None
        assert log.entity_type == "user"
        assert log.previous_data is not None
        assert log.new_data is not None
        assert log.new_data["status"] == "blocked"
        db.close()
    finally:
        _cleanup_user(user_id)
        _cleanup_user(admin_id)


def test_admin_unblock_user_creates_audit_log():
    """Test that unblocking a user creates an audit log entry."""
    admin_id, admin_headers, _, _ = _register_verified_user(as_admin=True)
    user_id, _, _, _ = _register_verified_user(as_admin=False)
    try:
        # First block the user
        client.post(f"/api/v1/admin/users/{user_id}/block", headers=admin_headers)
        
        # Then unblock
        resp = client.post(f"/api/v1/admin/users/{user_id}/unblock", headers=admin_headers)
        assert resp.status_code == 200
        
        # Check audit log was created
        db = SessionLocal()
        log = db.query(AuditLog).filter(
            AuditLog.admin_id == admin_id,
            AuditLog.action == "user_unblock",
            AuditLog.entity_id == user_id,
        ).first()
        assert log is not None
        assert log.previous_data["status"] == "blocked"
        assert log.new_data["status"] == "active"
        db.close()
    finally:
        _cleanup_user(user_id)
        _cleanup_user(admin_id)


def test_admin_delete_user_creates_audit_log():
    """Test that deleting a user creates an audit log entry."""
    admin_id, admin_headers, _, _ = _register_verified_user(as_admin=True)
    user_id, _, _, _ = _register_verified_user(as_admin=False)
    try:
        resp = client.delete(f"/api/v1/admin/users/{user_id}", headers=admin_headers)
        assert resp.status_code == 200
        
        # Check audit log was created
        db = SessionLocal()
        log = db.query(AuditLog).filter(
            AuditLog.admin_id == admin_id,
            AuditLog.action == "user_delete",
            AuditLog.entity_id == user_id,
        ).first()
        assert log is not None
        assert log.new_data["status"] == "deleted"
        assert log.new_data["deleted_at"] is not None
        db.close()
    finally:
        _cleanup_user(user_id)
        _cleanup_user(admin_id)


def test_admin_edit_user_creates_audit_log():
    """Test that editing a user creates an audit log entry."""
    admin_id, admin_headers, _, _ = _register_verified_user(as_admin=True)
    user_id, _, _, _ = _register_verified_user(as_admin=False)
    try:
        new_username = f"edited_{uuid.uuid4().hex[:8]}"
        resp = client.patch(
            f"/api/v1/admin/users/{user_id}",
            json={"username": new_username},
            headers=admin_headers,
        )
        assert resp.status_code == 200
        
        # Check audit log was created
        db = SessionLocal()
        log = db.query(AuditLog).filter(
            AuditLog.admin_id == admin_id,
            AuditLog.action == "user_edit",
            AuditLog.entity_id == user_id,
        ).first()
        assert log is not None
        assert log.previous_data["username"] != new_username
        assert log.new_data["username"] == new_username
        db.close()
    finally:
        _cleanup_user(user_id)
        _cleanup_user(admin_id)


def test_admin_delete_post_creates_audit_log():
    """Test that deleting a post creates an audit log entry."""
    admin_id, admin_headers, _, _ = _register_verified_user(as_admin=True)
    user_id, user_headers, _, _ = _register_verified_user(as_admin=False)
    
    try:
        # Create a post
        resp = client.post(
            "/api/v1/posts",
            json={"content": "Test post"},
            headers=user_headers,
        )
        assert resp.status_code == 201
        post_id = resp.json()["id"]
        
        # Admin deletes the post
        resp = client.delete(f"/api/v1/admin/posts/{post_id}", headers=admin_headers)
        assert resp.status_code == 200
        
        # Check audit log was created
        db = SessionLocal()
        log = db.query(AuditLog).filter(
            AuditLog.admin_id == admin_id,
            AuditLog.action == "post_delete",
            AuditLog.entity_id == uuid.UUID(post_id),
        ).first()
        assert log is not None
        assert log.entity_type == "post"
        assert log.new_data["status"] == "deleted"
        db.close()
    finally:
        _cleanup_user(user_id)
        _cleanup_user(admin_id)


def test_admin_edit_post_creates_audit_log():
    """Test that editing a post creates an audit log entry."""
    admin_id, admin_headers, _, _ = _register_verified_user(as_admin=True)
    user_id, user_headers, _, _ = _register_verified_user(as_admin=False)
    
    try:
        # Create a post
        resp = client.post(
            "/api/v1/posts",
            json={"content": "Original content"},
            headers=user_headers,
        )
        assert resp.status_code == 201
        post_id = resp.json()["id"]
        
        # Admin edits the post
        new_content = "Edited content"
        resp = client.patch(
            f"/api/v1/admin/posts/{post_id}",
            json={"content": new_content},
            headers=admin_headers,
        )
        assert resp.status_code == 200
        
        # Check audit log was created
        db = SessionLocal()
        log = db.query(AuditLog).filter(
            AuditLog.admin_id == admin_id,
            AuditLog.action == "post_edit",
            AuditLog.entity_id == uuid.UUID(post_id),
        ).first()
        assert log is not None
        assert "Original content" in log.previous_data["content"]
        assert new_content in log.new_data["content"]
        db.close()
    finally:
        _cleanup_user(user_id)
        _cleanup_user(admin_id)


def test_list_audit_logs():
    """Test listing audit logs."""
    admin_id, admin_headers, _, _ = _register_verified_user(as_admin=True)
    user_id, _, _, _ = _register_verified_user(as_admin=False)
    try:
        # Create some audit logs
        client.post(f"/api/v1/admin/users/{user_id}/block", headers=admin_headers)
        client.post(f"/api/v1/admin/users/{user_id}/unblock", headers=admin_headers)
        
        # List audit logs
        resp = client.get("/api/v1/admin/audit-logs", headers=admin_headers)
        assert resp.status_code == 200
        data = resp.json()
        assert data["total"] >= 2
        assert len(data["items"]) >= 2
    finally:
        _cleanup_user(user_id)
        _cleanup_user(admin_id)


def test_list_audit_logs_filter_by_action():
    """Test filtering audit logs by action."""
    admin_id, admin_headers, _, _ = _register_verified_user(as_admin=True)
    user_id, _, _, _ = _register_verified_user(as_admin=False)
    try:
        # Create audit logs
        client.post(f"/api/v1/admin/users/{user_id}/block", headers=admin_headers)
        client.post(f"/api/v1/admin/users/{user_id}/unblock", headers=admin_headers)
        
        # Filter by action
        resp = client.get(
            "/api/v1/admin/audit-logs?action=user_block",
            headers=admin_headers,
        )
        assert resp.status_code == 200
        data = resp.json()
        assert all(log["action"] == "user_block" for log in data["items"])
    finally:
        _cleanup_user(user_id)
        _cleanup_user(admin_id)


def test_list_audit_logs_filter_by_entity_id():
    """Test filtering audit logs by entity ID."""
    admin_id, admin_headers, _, _ = _register_verified_user(as_admin=True)
    user_id, _, _, _ = _register_verified_user(as_admin=False)
    try:
        # Create audit logs
        client.post(f"/api/v1/admin/users/{user_id}/block", headers=admin_headers)
        
        # Filter by entity_id
        resp = client.get(
            f"/api/v1/admin/audit-logs?entity_id={user_id}",
            headers=admin_headers,
        )
        assert resp.status_code == 200
        data = resp.json()
        assert all(str(log["entity_id"]) == str(user_id) for log in data["items"])
    finally:
        _cleanup_user(user_id)
        _cleanup_user(admin_id)


def test_non_admin_cannot_view_audit_logs():
    """Test that non-admins cannot view audit logs."""
    user_id, user_headers, _, _ = _register_verified_user(as_admin=False)
    try:
        resp = client.get("/api/v1/admin/audit-logs", headers=user_headers)
        assert resp.status_code == 403
    finally:
        _cleanup_user(user_id)


def test_get_single_audit_log():
    """Test retrieving a specific audit log."""
    admin_id, admin_headers, _, _ = _register_verified_user(as_admin=True)
    user_id, _, _, _ = _register_verified_user(as_admin=False)
    try:
        # Create an audit log
        client.post(f"/api/v1/admin/users/{user_id}/block", headers=admin_headers)
        
        # Get the log ID
        resp = client.get("/api/v1/admin/audit-logs", headers=admin_headers)
        logs = resp.json()["items"]
        log_id = logs[0]["id"]
        
        # Retrieve the specific log
        resp = client.get(f"/api/v1/admin/audit-logs/{log_id}", headers=admin_headers)
        assert resp.status_code == 200
        assert resp.json()["id"] == log_id
    finally:
        _cleanup_user(user_id)
        _cleanup_user(admin_id)