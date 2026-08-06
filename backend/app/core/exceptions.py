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

class PostNotFoundException(HTTPException):
    def __init__(self):
        super().__init__(status_code=status.HTTP_404_NOT_FOUND, detail="Post not found")

class NotPostOwnerException(HTTPException):
    def __init__(self):
        super().__init__(status_code=status.HTTP_403_FORBIDDEN, detail="You do not have permission to modify this post")

class InvalidFileTypeException(HTTPException):
    def __init__(self, allowed_types):
        super().__init__(
            status_code=status.HTTP_400_BAD_REQUEST,
            detail=f"Invalid file type. Allowed types: {', '.join(sorted(allowed_types))}",
        )

class FileTooLargeException(HTTPException):
    def __init__(self, max_size_bytes: int):
        super().__init__(
            status_code=status.HTTP_400_BAD_REQUEST,
            detail=f"File too large. Maximum size is {max_size_bytes // (1024 * 1024)} MB",
        )

class UserNotFoundException(HTTPException):
    def __init__(self):
        super().__init__(status_code=status.HTTP_404_NOT_FOUND, detail="User not found")

class UsernameTakenException(HTTPException):
    def __init__(self):
        super().__init__(status_code=status.HTTP_400_BAD_REQUEST, detail="That username is already taken")

class CommentNotFoundException(HTTPException):
    def __init__(self):
        super().__init__(status_code=status.HTTP_404_NOT_FOUND, detail="Comment not found")

class NotCommentOwnerOrPostOwnerException(HTTPException):
    def __init__(self):
        super().__init__(status_code=status.HTTP_403_FORBIDDEN, detail="Only the comment author or the post owner can delete this comment")

class ParentCommentNotFoundException(HTTPException):
    def __init__(self):
        super().__init__(
            status_code=status.HTTP_404_NOT_FOUND,
            detail="The comment you're replying to doesn't exist or was deleted",
        )

class ArchivedPostShareException(HTTPException):
    def __init__(self):
        super().__init__(status_code=status.HTTP_400_BAD_REQUEST, detail="Archived posts can't be shared")

class NotPostOwnerException(HTTPException):
    def __init__(self):
        super().__init__(status_code=status.HTTP_403_FORBIDDEN, detail="You do not have permission to modify this post")

class ArchivedPostShareException(HTTPException):
    def __init__(self):
        super().__init__(status_code=status.HTTP_400_BAD_REQUEST, detail="Archived posts can't be shared")

class MessageNotFoundException(HTTPException):
    def __init__(self):
        super().__init__(status_code=status.HTTP_404_NOT_FOUND, detail="Message not found")


class NotMessageOwnerException(HTTPException):
    def __init__(self):
        super().__init__(status_code=status.HTTP_403_FORBIDDEN, detail="You can only modify your own messages")

class MessageNotFoundException(HTTPException):
    def __init__(self):
        super().__init__(status_code=status.HTTP_404_NOT_FOUND, detail="Message not found")


class EmptyMessageException(HTTPException):
    def __init__(self):
        super().__init__(status_code=status.HTTP_400_BAD_REQUEST, detail="Message must have content or an attachment")


class AttachmentNotFoundException(HTTPException):
    def __init__(self):
        super().__init__(
            status_code=status.HTTP_400_BAD_REQUEST,
            detail="One or more attachments were not found or were already sent with another message",
        )
        
class AuditLogNotFoundException(HTTPException):
    def __init__(self):
        super().__init__(status_code=404, detail="Audit log not found")