from fastapi import Response
from app.config import (
    ACCESS_TOKEN_EXPIRE_MINUTES,
    REFRESH_TOKEN_EXPIRE_DAYS,
    ACCESS_TOKEN_COOKIE_NAME,
    REFRESH_TOKEN_COOKIE_NAME,
    COOKIE_SECURE,
    COOKIE_SAMESITE,
    COOKIE_DOMAIN,
)


def set_auth_cookies(response: Response, access_token: str, refresh_token: str) -> None:
    """Attach the access + refresh tokens to the response as httpOnly cookies.

    Works with any FastAPI/Starlette Response subclass (including
    RedirectResponse), so it can be used on normal JSON responses as well
    as OAuth redirect responses.
    """
    response.set_cookie(
        key=ACCESS_TOKEN_COOKIE_NAME,
        value=access_token,
        max_age=ACCESS_TOKEN_EXPIRE_MINUTES * 60,
        httponly=True,
        secure=COOKIE_SECURE,
        samesite=COOKIE_SAMESITE,
        domain=COOKIE_DOMAIN,
        path="/",
    )
    response.set_cookie(
        key=REFRESH_TOKEN_COOKIE_NAME,
        value=refresh_token,
        max_age=REFRESH_TOKEN_EXPIRE_DAYS * 24 * 60 * 60,
        httponly=True,
        secure=COOKIE_SECURE,
        samesite=COOKIE_SAMESITE,
        domain=COOKIE_DOMAIN,
        path="/",
    )


def clear_auth_cookies(response: Response) -> None:
    """Remove the access + refresh token cookies (used on logout)."""
    response.delete_cookie(key=ACCESS_TOKEN_COOKIE_NAME, path="/", domain=COOKIE_DOMAIN)
    response.delete_cookie(key=REFRESH_TOKEN_COOKIE_NAME, path="/", domain=COOKIE_DOMAIN)
