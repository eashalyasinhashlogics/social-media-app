import uuid
from unittest.mock import patch
from fastapi.testclient import TestClient
from app.main import app
from app.db.database import SessionLocal
from app.models.user import User
from app.models.user_profile import UserProfile
from app.models.post import Post
from app.models.media import Media

client = TestClient(app)

FAKE_S3_URL = "https://fake-bucket.s3.us-east-1.amazonaws.com/{key}"


async def _fake_send_otp_email(email, otp_code):
    """Stand-in for the real SMTP call so registration doesn't hit a live mail server."""
    return None


def _fake_upload_file_to_s3(file_bytes, content_type, folder):
    """Stand-in for the real S3 call so tests don't need real AWS credentials/bucket."""
    key = f"{folder}/{uuid.uuid4()}.jpg"
    return FAKE_S3_URL.format(key=key), key


def _register_verified_user():
    """Register a user, mark them verified, log in, and return (user_id, auth_headers)."""
    email = f"media_{uuid.uuid4().hex[:8]}@example.com"
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
    db.query(Media).filter(Media.uploader_id == user_id).delete()
    db.query(Post).filter(Post.author_id == user_id).delete()
    db.query(UserProfile).filter(UserProfile.user_id == user_id).delete()
    db.query(User).filter(User.id == user_id).delete()
    db.commit()
    db.close()


# ---------- avatar upload ----------

def test_avatar_upload_success():
    user_id, headers = _register_verified_user()
    try:
        with patch("app.services.media_service.upload_file_to_s3", _fake_upload_file_to_s3):
            resp = client.post(
                "/api/v1/media/avatar",
                headers=headers,
                files={"file": ("avatar.jpg", b"fake-image-bytes", "image/jpeg")},
            )
        assert resp.status_code == 201
        body = resp.json()
        assert body["media_type"] == "avatar"
        assert body["url"].startswith("https://fake-bucket.s3.us-east-1.amazonaws.com/avatars/")
    finally:
        _cleanup_user(user_id)


def test_avatar_upload_rejects_wrong_file_type():
    user_id, headers = _register_verified_user()
    try:
        with patch("app.services.media_service.upload_file_to_s3", _fake_upload_file_to_s3):
            resp = client.post(
                "/api/v1/media/avatar",
                headers=headers,
                files={"file": ("notes.txt", b"not a real image", "text/plain")},
            )
        assert resp.status_code == 400
    finally:
        _cleanup_user(user_id)


def test_avatar_upload_rejects_oversized_file():
    user_id, headers = _register_verified_user()
    try:
        oversized = b"0" * (6 * 1024 * 1024)  # 6 MB > 5 MB avatar limit
        with patch("app.services.media_service.upload_file_to_s3", _fake_upload_file_to_s3):
            resp = client.post(
                "/api/v1/media/avatar",
                headers=headers,
                files={"file": ("big.jpg", oversized, "image/jpeg")},
            )
        assert resp.status_code == 400
    finally:
        _cleanup_user(user_id)


def test_avatar_upload_requires_auth():
    resp = client.post(
        "/api/v1/media/avatar",
        files={"file": ("avatar.jpg", b"fake-image-bytes", "image/jpeg")},
    )
    assert resp.status_code == 401


# ---------- post media upload / ownership ----------

def test_post_media_upload_ownership_enforced():
    user_a_id, headers_a = _register_verified_user()
    user_b_id, headers_b = _register_verified_user()
    try:
        resp = client.post("/api/v1/posts", json={"content": "post for media"}, headers=headers_a)
        post_id = resp.json()["id"]

        with patch("app.services.media_service.upload_file_to_s3", _fake_upload_file_to_s3):
            # Owner can attach media
            resp = client.post(
                f"/api/v1/media/post/{post_id}",
                headers=headers_a,
                files={"file": ("photo.jpg", b"fake-image-bytes", "image/jpeg")},
            )
            assert resp.status_code == 201
            assert resp.json()["media_type"] == "image"

            # Non-owner cannot attach media to someone else's post
            resp = client.post(
                f"/api/v1/media/post/{post_id}",
                headers=headers_b,
                files={"file": ("photo.jpg", b"fake-image-bytes", "image/jpeg")},
            )
            assert resp.status_code == 403
    finally:
        _cleanup_user(user_a_id)
        _cleanup_user(user_b_id)


def test_post_media_upload_nonexistent_post_404():
    user_id, headers = _register_verified_user()
    try:
        with patch("app.services.media_service.upload_file_to_s3", _fake_upload_file_to_s3):
            resp = client.post(
                f"/api/v1/media/post/{uuid.uuid4()}",
                headers=headers,
                files={"file": ("photo.jpg", b"fake-image-bytes", "image/jpeg")},
            )
        assert resp.status_code == 404
    finally:
        _cleanup_user(user_id)


def test_post_video_upload_sets_correct_media_type():
    user_id, headers = _register_verified_user()
    try:
        resp = client.post("/api/v1/posts", json={"content": "video post"}, headers=headers)
        post_id = resp.json()["id"]

        with patch("app.services.media_service.upload_file_to_s3", _fake_upload_file_to_s3):
            resp = client.post(
                f"/api/v1/media/post/{post_id}",
                headers=headers,
                files={"file": ("clip.mp4", b"fake-video-bytes", "video/mp4")},
            )
        assert resp.status_code == 201
        assert resp.json()["media_type"] == "video"
    finally:
        _cleanup_user(user_id)


# ---------- profile: own vs public, avatar linking ----------

def test_own_profile_shows_archived_posts_and_linked_avatar():
    user_id, headers = _register_verified_user()
    try:
        with patch("app.services.media_service.upload_file_to_s3", _fake_upload_file_to_s3):
            avatar_resp = client.post(
                "/api/v1/media/avatar",
                headers=headers,
                files={"file": ("avatar.jpg", b"fake-image-bytes", "image/jpeg")},
            )
        avatar_url = avatar_resp.json()["url"]

        archive_resp = client.post("/api/v1/posts", json={"content": "will be archived"}, headers=headers)
        archive_post_id = archive_resp.json()["id"]
        client.patch(f"/api/v1/posts/{archive_post_id}/archive", headers=headers)

        resp = client.get("/api/v1/users/me/profile", headers=headers)
        assert resp.status_code == 200
        body = resp.json()

        assert body["avatar_url"] == avatar_url
        assert any(p["id"] == archive_post_id for p in body["posts"])
    finally:
        _cleanup_user(user_id)


def test_public_profile_hides_archived_posts():
    user_id, headers = _register_verified_user()
    try:
        active_resp = client.post("/api/v1/posts", json={"content": "stays active"}, headers=headers)
        active_id = active_resp.json()["id"]

        archive_resp = client.post("/api/v1/posts", json={"content": "gets archived"}, headers=headers)
        archive_id = archive_resp.json()["id"]
        client.patch(f"/api/v1/posts/{archive_id}/archive", headers=headers)

        resp = client.get(f"/api/v1/users/{user_id}/profile")
        assert resp.status_code == 200
        body = resp.json()

        post_ids = [p["id"] for p in body["posts"]]
        assert active_id in post_ids
        assert archive_id not in post_ids
    finally:
        _cleanup_user(user_id)


def test_public_profile_nonexistent_user_404():
    resp = client.get(f"/api/v1/users/{uuid.uuid4()}/profile")
    assert resp.status_code == 404


# ---------- bio update ----------

def test_bio_update():
    user_id, headers = _register_verified_user()
    try:
        resp = client.patch(
            "/api/v1/users/me/profile",
            json={"bio": "Updated bio from pytest"},
            headers=headers,
        )
        assert resp.status_code == 200
        assert resp.json()["bio"] == "Updated bio from pytest"

        # Confirm it persists on a fresh fetch
        resp = client.get("/api/v1/users/me/profile", headers=headers)
        assert resp.json()["bio"] == "Updated bio from pytest"
    finally:
        _cleanup_user(user_id)


def test_bio_update_requires_auth():
    resp = client.patch("/api/v1/users/me/profile", json={"bio": "no auth"})
    assert resp.status_code == 401