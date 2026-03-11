from datetime import datetime
from enum import Enum

from pydantic import BaseModel, Field


class SessionStatus(str, Enum):
    idle = "idle"
    uploading = "uploading"
    processing = "processing"
    complete = "complete"
    error = "error"


class SessionCreateResponse(BaseModel):
    id: str
    created_at: datetime
    status: SessionStatus


class AngleMetadata(BaseModel):
    id: str
    label: str
    file_name: str
    file_size: int
    storage_path: str


class SessionReadResponse(BaseModel):
    id: str
    created_at: datetime
    status: SessionStatus
    angles: list[AngleMetadata] = Field(default_factory=list)


class UploadAnglesResponse(BaseModel):
    accepted: bool = True
    uploaded_count: int
