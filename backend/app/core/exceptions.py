from fastapi import HTTPException, status

class InvalidCredentialsException(HTTPException):
    def __init__(self):
        super().__init__(status_code=status.HTTP_401_UNAUTHORIZED, detail="Invalid email or password")

class UserAlreadyExistsException(HTTPException):
    def __init__(self, field: str = "user"):
        super().__init__(status_code=status.HTTP_400_BAD_REQUEST, detail=f"A {field} with this email or username already exists")

class UserNotVerifiedException(HTTPException):
    def __init__(self):
        super().__init__(status_code=status.HTTP_403_FORBIDDEN, detail="Please verify your email before logging in")

class UserBlockedException(HTTPException):
    def __init__(self, status_value: str = "blocked"):
        super().__init__(status_code=status.HTTP_403_FORBIDDEN, detail=f"This account is {status_value}")

class InvalidTokenException(HTTPException):
    def __init__(self):
        super().__init__(status_code=status.HTTP_401_UNAUTHORIZED, detail="Invalid or expired token")
