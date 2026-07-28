import boto3
import uuid
from app.config import AWS_ACCESS_KEY_ID, AWS_SECRET_ACCESS_KEY, AWS_REGION, S3_BUCKET_NAME

_s3_client = boto3.client(
    "s3",
    aws_access_key_id=AWS_ACCESS_KEY_ID,
    aws_secret_access_key=AWS_SECRET_ACCESS_KEY,
    region_name=AWS_REGION,
)

_EXTENSION_MAP = {
    "image/jpeg": ".jpg",
    "image/png": ".png",
    "image/webp": ".webp",
    "image/gif": ".gif",
    "video/mp4": ".mp4",
}


def upload_file_to_s3(file_bytes: bytes, content_type: str, folder: str) -> tuple[str, str]:
    """
    Uploads raw bytes to S3 under the given folder ("avatars" or "posts").
    Returns (public_url, s3_key).
    """
    extension = _EXTENSION_MAP.get(content_type, "")
    key = f"{folder}/{uuid.uuid4()}{extension}"

    _s3_client.put_object(
        Bucket=S3_BUCKET_NAME,
        Key=key,
        Body=file_bytes,
        ContentType=content_type,
    )

    url = f"https://{S3_BUCKET_NAME}.s3.{AWS_REGION}.amazonaws.com/{key}"
    return url, key