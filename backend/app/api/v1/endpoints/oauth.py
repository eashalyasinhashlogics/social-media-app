from fastapi import APIRouter, Depends, HTTPException, status, Query, Request
from fastapi.responses import RedirectResponse
from sqlalchemy.orm import Session
import httpx
from app.core.dependencies import get_db
from app.core.cookies import set_auth_cookies
from app.schemas.auth import TokenResponse
from app.schemas.oauth import GoogleAuthUrlResponse, GithubAuthUrlResponse
from app.services.auth_service import AuthService
from app.config import (
    GOOGLE_CLIENT_ID, GOOGLE_CLIENT_SECRET, GOOGLE_REDIRECT_URI,
    GITHUB_CLIENT_ID, GITHUB_CLIENT_SECRET, GITHUB_REDIRECT_URI,
    FRONTEND_URL,
)

router = APIRouter(prefix="/oauth", tags=["oauth"])

@router.get("/google/authorize", response_model=GoogleAuthUrlResponse)
def google_authorize():
    if not GOOGLE_CLIENT_ID:
        raise HTTPException(status_code=status.HTTP_501_NOT_IMPLEMENTED, detail="Google OAuth not configured")

    auth_url = (
        "https://accounts.google.com/o/oauth2/v2/auth"
        f"?client_id={GOOGLE_CLIENT_ID}"
        f"&redirect_uri={GOOGLE_REDIRECT_URI}"
        "&response_type=code"
        "&scope=openid%20email%20profile"
        "&access_type=offline"
        "&prompt=consent"
    )
    return GoogleAuthUrlResponse(auth_url=auth_url)

@router.get("/google/callback")
async def google_callback(code: str = Query(...), request: Request = None, db: Session = Depends(get_db)):
    if not GOOGLE_CLIENT_ID:
        raise HTTPException(status_code=status.HTTP_501_NOT_IMPLEMENTED, detail="Google OAuth not configured")

    async with httpx.AsyncClient() as client:
        token_response = await client.post(
            "https://oauth2.googleapis.com/token",
            data={
                "code": code,
                "client_id": GOOGLE_CLIENT_ID,
                "client_secret": GOOGLE_CLIENT_SECRET,
                "redirect_uri": GOOGLE_REDIRECT_URI,
                "grant_type": "authorization_code",
            },
        )

        if token_response.status_code != 200:
            raise HTTPException(status_code=status.HTTP_400_BAD_REQUEST, detail=f"Google token exchange failed: {token_response.text}")

        google_tokens = token_response.json()

        userinfo_response = await client.get(
            "https://openidconnect.googleapis.com/v1/userinfo",
            headers={"Authorization": f"Bearer {google_tokens['access_token']}"},
        )
        userinfo = userinfo_response.json()

    ip_address = request.client.host if request and request.client else "unknown"
    user_agent = request.headers.get("user-agent", "unknown") if request else "unknown"

    tokens = AuthService.oauth_login(
        db,
        provider="google",
        provider_user_id=userinfo["sub"],
        email=userinfo["email"],
        name=userinfo.get("name", userinfo["email"]),
        ip_address=ip_address,
        user_agent=user_agent,
    )

    redirect = RedirectResponse(url=f"{FRONTEND_URL}/oauth/callback")
    set_auth_cookies(redirect, tokens.access_token, tokens.refresh_token)
    return redirect


@router.get("/github/authorize", response_model=GithubAuthUrlResponse)
def github_authorize():
    if not GITHUB_CLIENT_ID:
        raise HTTPException(status_code=status.HTTP_501_NOT_IMPLEMENTED, detail="GitHub OAuth not configured")

    auth_url = (
        "https://github.com/login/oauth/authorize"
        f"?client_id={GITHUB_CLIENT_ID}"
        f"&redirect_uri={GITHUB_REDIRECT_URI}"
        "&scope=read:user%20user:email"
    )
    return GithubAuthUrlResponse(auth_url=auth_url)


@router.get("/github/callback")
async def github_callback(code: str = Query(...), request: Request = None, db: Session = Depends(get_db)):
    if not GITHUB_CLIENT_ID:
        raise HTTPException(status_code=status.HTTP_501_NOT_IMPLEMENTED, detail="GitHub OAuth not configured")

    async with httpx.AsyncClient() as client:
        token_response = await client.post(
            "https://github.com/login/oauth/access_token",
            data={
                "code": code,
                "client_id": GITHUB_CLIENT_ID,
                "client_secret": GITHUB_CLIENT_SECRET,
                "redirect_uri": GITHUB_REDIRECT_URI,
            },
            headers={"Accept": "application/json"},
        )

        if token_response.status_code != 200:
            raise HTTPException(status_code=status.HTTP_400_BAD_REQUEST, detail=f"GitHub token exchange failed: {token_response.text}")

        github_tokens = token_response.json()
        if "access_token" not in github_tokens:
            raise HTTPException(status_code=status.HTTP_400_BAD_REQUEST, detail=f"GitHub token exchange failed: {github_tokens}")

        auth_header = {
            "Authorization": f"Bearer {github_tokens['access_token']}",
            "Accept": "application/vnd.github+json",
        }

        user_response = await client.get("https://api.github.com/user", headers=auth_header)
        user_data = user_response.json()

        # GitHub only returns a public email if the user has one set.
        # If it's missing, fetch the verified primary email separately.
        email = user_data.get("email")
        if not email:
            emails_response = await client.get("https://api.github.com/user/emails", headers=auth_header)
            emails = emails_response.json()
            primary = next((e for e in emails if e.get("primary") and e.get("verified")), None)
            if not primary and emails:
                primary = emails[0]
            email = primary["email"] if primary else None

        if not email:
            raise HTTPException(
                status_code=status.HTTP_400_BAD_REQUEST,
                detail="GitHub account has no accessible email address. Please make an email public or verified on GitHub.",
            )

    ip_address = request.client.host if request and request.client else "unknown"
    user_agent = request.headers.get("user-agent", "unknown") if request else "unknown"

    tokens = AuthService.oauth_login(
        db,
        provider="github",
        provider_user_id=str(user_data["id"]),
        email=email,
        name=user_data.get("name") or user_data.get("login"),
        ip_address=ip_address,
        user_agent=user_agent,
    )

    redirect = RedirectResponse(url=f"{FRONTEND_URL}/oauth/callback")
    set_auth_cookies(redirect, tokens.access_token, tokens.refresh_token)
    return redirect