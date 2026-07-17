import uuid
import pytest
from app.db.database import SessionLocal
from app.services.user_service import UserService
from app.schemas.user import UserCreate
from app.core.exceptions import UserAlreadyExistsException, InvalidCredentialsException
from app.models.user import User

@pytest.fixture
def db():
    session = SessionLocal()
    yield session
    session.close()

def _unique_email():
    return f"svc_{uuid.uuid4().hex[:8]}@example.com"

def test_create_user(db):
    email = _unique_email()
    data = UserCreate(email=email, username=f"u{uuid.uuid4().hex[:8]}", password="TestPass123!")
    user = UserService.create_user(db, data)
    assert user.email == email
    assert user.profile is not None
    db.delete(user)
    db.commit()

def test_duplicate_user_rejected(db):
    email = _unique_email()
    username = f"u{uuid.uuid4().hex[:8]}"
    data = UserCreate(email=email, username=username, password="TestPass123!")
    user = UserService.create_user(db, data)

    try:
        try:
            UserService.create_user(db, data)
            assert False, "Should have raised"
        except UserAlreadyExistsException:
            pass
    finally:
        db.delete(user)
        db.commit()

def test_wrong_password_rejected(db):
    email = _unique_email()
    data = UserCreate(email=email, username=f"u{uuid.uuid4().hex[:8]}", password="TestPass123!")
    user = UserService.create_user(db, data)

    try:
        try:
            UserService.authenticate_user(db, email, "WrongPassword")
            assert False, "Should have raised"
        except InvalidCredentialsException:
            pass
    finally:
        db.delete(user)
        db.commit()
