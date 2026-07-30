from fastapi import APIRouter
from app.api.v1.endpoints import auth, users, oauth, posts, media, comments, friends, conversations, notifications, admin

api_router = APIRouter(prefix="/api/v1")
api_router.include_router(auth.router)
api_router.include_router(users.router)
api_router.include_router(oauth.router)
api_router.include_router(posts.router)
api_router.include_router(media.router)
api_router.include_router(comments.router)
api_router.include_router(friends.friend_requests_router)
api_router.include_router(friends.friends_router)
api_router.include_router(conversations.router)
api_router.include_router(notifications.router)
api_router.include_router(admin.router)
