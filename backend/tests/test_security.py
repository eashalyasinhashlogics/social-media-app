from app.core.security import hash_password, verify_password, create_access_token, create_refresh_token, decode_token
from jose import JWTError
import pytest

def test_password_hash_and_verify():
    pw = "SecurePass123!"
    hashed = hash_password(pw)
    assert verify_password(pw, hashed) is True
    assert verify_password("WrongPass", hashed) is False

def test_access_token_roundtrip():
    token = create_access_token({"sub": "user123"})
    decoded = decode_token(token)
    assert decoded["sub"] == "user123"

def test_refresh_token_has_type():
    token = create_refresh_token({"sub": "user123"})
    decoded = decode_token(token)
    assert decoded["type"] == "refresh"

def test_invalid_token_raises():
    with pytest.raises(JWTError):
        decode_token("invalid.token.value")
