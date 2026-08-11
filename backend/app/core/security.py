from passlib.context import CryptContext
from datetime import datetime, timedelta , timezone
from jose import JWTError, jwt
from app.config import SECRET_KEY, ALGORITHM, ACCESS_TOKEN_EXPIRE_MINUTES, REFRESH_TOKEN_EXPIRE_DAYS

# bcrypt_sha256 pre-hashes with SHA-256 before bcrypt, removing the 72-byte
# password limit. "bcrypt" is kept as a fallback so any existing hashes in
# the database (from before this change) still verify correctly.
pwd_context = CryptContext(schemes=["bcrypt_sha256", "bcrypt"], deprecated="auto")

def hash_password(password: str) -> str:
    truncated_password = password.encode('utf-8')[:72].decode('utf-8', errors='ignore')
    return pwd_context.hash(truncated_password)

def verify_password(plain_password: str, hashed_password: str) -> bool:
    try:
        return pwd_context.verify(plain_password, hashed_password)
    except Exception:
        return False

def create_access_token(data: dict, expires_delta: timedelta = None) -> str:
    to_encode = data.copy()
    expire = datetime.now(timezone.utc) + (expires_delta or timedelta(minutes=ACCESS_TOKEN_EXPIRE_MINUTES))
    # Explicit "type": "access" claim so every consumer of decode_token can
    # positively check *what kind* of token it received, instead of only
    # refresh tokens being tagged and access tokens being "whatever doesn't
    # say refresh". See P-1: nothing previously read the refresh claim, so
    # a 30-day refresh token authenticated every API call and WS connection.
    to_encode.update({"exp": expire, "type": "access"})
    return jwt.encode(to_encode, SECRET_KEY, algorithm=ALGORITHM)

def create_refresh_token(data: dict) -> str:
    to_encode = data.copy()
    expire = datetime.now(timezone.utc)+ timedelta(days=REFRESH_TOKEN_EXPIRE_DAYS)
    to_encode.update({"exp": expire, "type": "refresh"})
    return jwt.encode(to_encode, SECRET_KEY, algorithm=ALGORITHM)

def decode_token(token: str) -> dict:
    try:
        return jwt.decode(token, SECRET_KEY, algorithms=[ALGORITHM])
    except JWTError as e:
        raise JWTError(f"Invalid token: {str(e)}")