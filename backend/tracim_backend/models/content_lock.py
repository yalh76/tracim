from datetime import datetime

from sqlalchemy import Boolean
from sqlalchemy import Column
from sqlalchemy import DateTime
from sqlalchemy import ForeignKey
from sqlalchemy import Integer
from sqlalchemy import Unicode

from tracim_backend.models.meta import DeclarativeBase


class UploadContentLock(DeclarativeBase):
    __tablename__ = "upload_content_lock"

    lock_token = Column(Unicode(256), primary_key=True, nullable=False)
    user_id = Column(Integer, ForeignKey("users.user_id"), nullable=False, default=None)
    content_id = Column(Integer, ForeignKey("content.id"), nullable=False, default=None)
    created = Column(DateTime, default=datetime.utcnow)
    enabled = Column(Boolean, default=True)
