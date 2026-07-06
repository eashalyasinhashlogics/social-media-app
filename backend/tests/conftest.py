import pytest
from unittest.mock import AsyncMock, patch
from app.db.database import SessionLocal

@pytest.fixture
def db():
    session = SessionLocal()
    yield session
    session.close()

@pytest.fixture(autouse=True)
def mock_email_sending():
    """Prevent any test from sending a real email via SMTP."""
    with patch("app.api.v1.endpoints.auth.send_otp_email", new_callable=AsyncMock) as mock_send:
        yield mock_send
