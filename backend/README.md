# Social Media API - Backend (Week 1 Complete)

FastAPI backend with JWT auth, hashed OTP verification, and DB-backed refresh token sessions.

## Setup

```powershell
cd backend
python -m venv venv
.\venv\Scripts\Activate.ps1
pip install -r requirements.txt
docker-compose up -d
alembic upgrade head
uvicorn app.main:app --reload
```

Server: http://localhost:8000
Docs: http://localhost:8000/docs

## Endpoints

POST /api/v1/auth/register
POST /api/v1/auth/verify-email
POST /api/v1/auth/resend-otp
POST /api/v1/auth/login
POST /api/v1/auth/refresh
POST /api/v1/auth/logout
GET  /api/v1/users/me
GET  /api/v1/users/{user_id}

## Architecture

app/models -> app/schemas -> app/services -> app/api/v1/endpoints
app/core holds security, dependencies, exceptions

## Testing

```powershell
pytest tests\ -v --cov=app
```

## Deferred to Week 2+

- media table and profile_picture_id foreign key
- posts/comments/likes
- full-text search, partitioning, archival
