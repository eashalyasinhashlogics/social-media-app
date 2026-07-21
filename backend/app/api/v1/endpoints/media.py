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