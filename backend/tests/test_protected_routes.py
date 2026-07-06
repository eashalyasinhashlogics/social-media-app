from fastapi.testclient import TestClient
from app.main import app

client = TestClient(app)

def test_me_without_token_rejected():
    resp = client.get("/api/v1/users/me")
    assert resp.status_code == 401

def test_me_with_invalid_token_rejected():
    resp = client.get("/api/v1/users/me", headers={"Authorization": "Bearer invalid.token.here"})
    assert resp.status_code == 401

def test_get_nonexistent_user_returns_404():
    resp = client.get("/api/v1/users/00000000-0000-0000-0000-000000000000")
    assert resp.status_code == 404
