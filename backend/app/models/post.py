from sqlalchemy import Column, Integer, Text, DateTime, ForeignKey
from sqlalchemy import Enum as SAEnum
from sqlalchemy.dialects.postgresql import UUID
from sqlalchemy.orm import relationship
import uuid
from datetime import datetime
from app.db.base import Base
from app.db.enums import PostStatus


class Post(Base):
    __tablename__ = "posts"

    id = Column(UUID(as_uuid=True), primary_key=True, default=uuid.uuid4, nullable=False)
    author_id = Column(UUID(as_uuid=True), ForeignKey("users.id", ondelete="CASCADE"), nullable=False, index=True)
    content = Column(Text, nullable=False)

    status = Column(SAEnum(PostStatus, name="post_status"), default=PostStatus.active, nullable=False)

    like_count = Column(Integer, default=0, nullable=False)
    comment_count = Column(Integer, default=0, nullable=False)
    share_count = Column(Integer, default=0, nullable=False)

    original_post_id = Column(UUID(as_uuid=True), ForeignKey("posts.id", ondelete="SET NULL"), nullable=True, index=True)

    created_at = Column(DateTime, default=datetime.utcnow, nullable=False)
    updated_at = Column(DateTime, default=datetime.utcnow, onupdate=datetime.utcnow, nullable=False)
    deleted_at = Column(DateTime, nullable=True)

    author = relationship("User", backref="posts")

    def __repr__(self):
        return f"<Post(id={self.id}, author_id={self.author_id}, status={self.status})>"

 