from fastapi import APIRouter, Depends, status, HTTPException, Request, Response
from sqlalchemy.orm import Session
from app.core.dependencies import get_db, get_current_user
from app.core.email import send_otp_email
from app.core.cookies import set_auth_cookies, clear_auth_cookies
from app.core.exceptions import InvalidTokenException
from app.schemas.user import UserCreate
from app.schemas.auth import LoginRequest, TokenResponse, RefreshRequest
from app.schemas.otp import OTPVerifyRequest, OTPResendRequest, OTPResponse
from app.services.auth_service import AuthService
from app.services.otp_service import OTPService
from app.services.user_service import UserService
from app.config import REFRESH_TOKEN_COOKIE_NAME
from app.db.enums import OTPType
from app.models.user import User

router = APIRouter(prefix="/auth", tags=["authentication"])

@router.post("/register", status_code=status.HTTP_201_CREATED)
async def register(user_create: UserCreate, db: Session = Depends(get_db)):
    user = UserService.create_user(db, user_create)
    otp_code = OTPService.send_otp(db, str(user.id), OTPType.email_verification)

    try:
        await send_otp_email(user.email, otp_code)
    except Exception as e:
        import logging
        logging.getLogger("uvicorn.error").error(f"Failed to send OTP email to {user.email}: {e}")
        db.delete(user)
        db.commit()
        raise HTTPException(
            status_code=status.HTTP_502_BAD_GATEWAY,
            detail="Could not send verification email. Please try registering again."
        )

    return {
        "message": f"User registered. OTP sent to {user.email}",
        "user_id": str(user.id),
        "email": user.email
    }

@router.post("/verify-email")
def verify_email(request: OTPVerifyRequest, db: Session = Depends(get_db)):
    return AuthService.verify_email_otp(db, request.email, request.otp_code)

@router.post("/resend-otp", response_model=OTPResponse)
async def resend_otp(request: OTPResendRequest, db: Session = Depends(get_db)):
    user = UserService.get_user_by_email(db, request.email)
    if not user:
        raise HTTPException(status_code=404, detail="User not found")
    otp_code = OTPService.send_otp(db, str(user.id), OTPType.email_verification)
    await send_otp_email(user.email, otp_code)
    return OTPResponse(message=f"OTP sent to {request.email}", email=request.email)

@router.post("/login", response_model=TokenResponse)
def login(credentials: LoginRequest, request: Request, response: Response, db: Session = Depends(get_db)):
    ip_address = request.client.host if request.client else "unknown"
    user_agent = request.headers.get("user-agent", "unknown")
    tokens = AuthService.login(db, credentials.email, credentials.password, ip_address, user_agent)
    # Set httpOnly cookies in addition to returning the tokens in the body,
    # so existing API/test clients that read the JSON body keep working
    # while the browser-based frontend can rely on the cookies instead.
    set_auth_cookies(response, tokens.access_token, tokens.refresh_token)
    return tokens

@router.post("/refresh", response_model=TokenResponse)
def refresh_token(body: RefreshRequest, request: Request, response: Response, db: Session = Depends(get_db)):
    refresh_value = body.refresh_token or request.cookies.get(REFRESH_TOKEN_COOKIE_NAME)
    if not refresh_value:
        raise HTTPException(status_code=status.HTTP_401_UNAUTHORIZED, detail="Refresh token missing")

    tokens = AuthService.refresh_access_token(db, refresh_value)
    set_auth_cookies(response, tokens.access_token, tokens.refresh_token)
    return tokens

@router.post("/logout")
def logout(
    body: RefreshRequest,
    request: Request,
    response: Response,
    current_user: User = Depends(get_current_user),
    db: Session = Depends(get_db)
):
    refresh_value = body.refresh_token or request.cookies.get(REFRESH_TOKEN_COOKIE_NAME)
    if refresh_value:
        try:
            AuthService.logout(db, str(current_user.id), refresh_value)
        except InvalidTokenException:
            # Token already revoked/unknown - still proceed to clear cookies below.
            pass
    clear_auth_cookies(response)
    return {"message": "Logged out successfully"}
