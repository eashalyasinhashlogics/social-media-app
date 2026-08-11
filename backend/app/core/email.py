from functools import lru_cache

from fastapi_mail import FastMail, MessageSchema, ConnectionConfig, MessageType
from app.config import SMTP_SERVER, SMTP_PORT, SMTP_USER, SMTP_PASSWORD, SMTP_FROM_NAME


@lru_cache(maxsize=1)
def _mailer() -> FastMail:
    """Build the SMTP connection on first send, not at import time.

    ConnectionConfig validates MAIL_FROM as an email address. SMTP_USER
    defaults to "" (app/config.py), so building this at module scope meant an
    environment without SMTP credentials could not even *import* the app:
    app.main -> api_router -> endpoints.auth -> here -> ValidationError, and
    the container died before uvicorn started.

    Deferring it keeps a missing SMTP config a mail problem rather than a
    boot problem. The caller in endpoints/auth.py already wraps the send in
    try/except, so it surfaces as a logged 502 on register instead.
    """
    return FastMail(
        ConnectionConfig(
            MAIL_USERNAME=SMTP_USER,
            MAIL_PASSWORD=SMTP_PASSWORD,
            MAIL_FROM=SMTP_USER,
            MAIL_FROM_NAME=SMTP_FROM_NAME,
            MAIL_PORT=SMTP_PORT,
            MAIL_SERVER=SMTP_SERVER,
            MAIL_STARTTLS=True,
            MAIL_SSL_TLS=False,
            USE_CREDENTIALS=True,
            VALIDATE_CERTS=True,
        )
    )


async def send_otp_email(to_email: str, otp_code: str) -> None:
    html = f"""
    <div style="font-family: Arial, sans-serif; max-width: 480px; margin: auto;">
        <h2 style="color:#1F3864;">Verify your email</h2>
        <p>Your verification code is:</p>
        <p style="font-size: 32px; font-weight: bold; letter-spacing: 6px; color:#2E75B6;">{otp_code}</p>
        <p>This code expires in 10 minutes. If you did not request this, you can ignore this email.</p>
    </div>
    """
    message = MessageSchema(
        subject="Your verification code",
        recipients=[to_email],
        body=html,
        subtype=MessageType.html,
    )
    await _mailer().send_message(message)
