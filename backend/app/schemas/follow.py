from pydantic import BaseModel
import uuid


class FollowResponse(BaseModel):
    following: bool
    follower_count: int
    following_count: int


class FollowerUser(BaseModel):
    id: uuid.UUID
    username: str
    display_name: str | None = None
    avatar_url: str | None = None

    class Config:
        from_attributes = True