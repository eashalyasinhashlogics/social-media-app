from fastapi import APIRouter, Depends, UploadFile, File, status
from sqlalchemy.orm import Session
import uuid

from app.core.dependencies import get_db, get_current_user
from app.models.user import User
from app.schemas.media import MediaResponse
from app.services.media_service import MediaService

router = APIRouter(prefix="/media", tags=["media"])


@router.post("/avatar", response_model=MediaResponse, status_code=status.HTTP_201_CREATED)
async def upload_avatar(
    file: UploadFile = File(...),
    current_user: User = Depends(get_current_user),
    db: Session = Depends(get_db),
):
    return await MediaService.upload_avatar(db, current_user.id, file)


@router.post("/cover", response_model=MediaResponse, status_code=status.HTTP_201_CREATED)
async def upload_cover_photo(
    file: UploadFile = File(...),
    current_user: User = Depends(get_current_user),
    db: Session = Depends(get_db),
):
    return await MediaService.upload_cover_photo(db, current_user.id, file)


@router.post("/post/{post_id}", response_model=MediaResponse, status_code=status.HTTP_201_CREATED)
async def upload_post_media(
    post_id: uuid.UUID,
    file: UploadFile = File(...),
    current_user: User = Depends(get_current_user),
    db: Session = Depends(get_db),
):
    return await MediaService.upload_post_media(db, current_user.id, post_id, file)

@router.post("/message-attachment/{conversation_id}", response_model=MediaResponse, status_code=status.HTTP_201_CREATED)
async def upload_message_attachment(
    conversation_id: uuid.UUID,
    file: UploadFile = File(...),
    current_user: User = Depends(get_current_user),
    db: Session = Depends(get_db),
):
    """Uploads a chat attachment (image/video/document) ahead of sending a
    message, so the client can preview it and show upload progress. Returns
    an unlinked Media row - pass its id in `attachment_ids` on
    POST /conversations/{conversation_id}/messages to attach it."""
    return await MediaService.upload_message_attachment(db, current_user.id, conversation_id, file)

@router.delete("/avatar", status_code=204)
def remove_avatar(
    current_user: User = Depends(get_current_user),
    db: Session = Depends(get_db),
):
    ProfileService.remove_avatar(db, current_user.id)
    return None


@router.delete("/cover", status_code=204)
def remove_cover_photo(
    current_user: User = Depends(get_current_user),
    db: Session = Depends(get_db),
):
    ProfileService.remove_cover_photo(db, current_user.id)
    return None