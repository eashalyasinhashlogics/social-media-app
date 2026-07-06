from pydantic import BaseModel, EmailStr, Field

class OTPVerifyRequest(BaseModel):
    email: EmailStr
    otp_code: str = Field(..., min_length=6, max_length=6)

class OTPResendRequest(BaseModel):
    email: EmailStr

class OTPResponse(BaseModel):
    message: str
    email: str
