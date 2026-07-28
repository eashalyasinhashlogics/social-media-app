import enum

class UserRole(str, enum.Enum):
    user = "user"
    admin = "admin"

class UserStatus(str, enum.Enum):
    active = "active"
    blocked = "blocked"
    suspended = "suspended"
    deleted = "deleted"

class OTPType(str, enum.Enum):
    email_verification = "email_verification"
    password_reset = "password_reset"
    email_change = "email_change"

class PostStatus(str, enum.Enum):
    active = "active"
    archived = "archived"
    deleted = "deleted"

class MediaType(str, enum.Enum):
    image = "image"
    video = "video"
    avatar = "avatar"
    cover = "cover"