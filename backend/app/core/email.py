from fastapi_mail import FastMail, MessageSchema, ConnectionConfig, MessageType
from app.config import SMTP_SERVER, SMTP_PORT, SMTP_USER, SMTP_PASSWORD, SMTP_FROM_NAME

conf = ConnectionConfig(
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

fm = FastMail(conf)

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
    await fm.send_message(message)
