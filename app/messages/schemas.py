from datetime import datetime

from pydantic import BaseModel, ConfigDict, Field

from app.messages.models import DeliveryState, MessageStatus, MessageType
from app.users.schemas import UserBrief


class MessageAttachmentIn(BaseModel):
    bucket: str = Field(min_length=1, max_length=128)
    object_key: str = Field(min_length=1, max_length=1024)
    original_name: str = Field(min_length=1, max_length=255)
    mime_type: str = Field(min_length=1, max_length=255)
    size_bytes: int = Field(gt=0)
    public_url: str | None = Field(default=None, max_length=2048)


class MessageAttachmentOut(BaseModel):
    model_config = ConfigDict(from_attributes=True)

    id: int
    bucket: str
    object_key: str
    original_name: str
    mime_type: str
    size_bytes: int
    public_url: str | None
    created_at: datetime


class MessageCreateRequest(BaseModel):
    conversation_id: int
    content: str | None = Field(default=None, max_length=10000)
    type: MessageType = MessageType.text
    client_message_id: str = Field(min_length=8, max_length=64)
    attachments: list[MessageAttachmentIn] = Field(default_factory=list)


class MessageUpdateRequest(BaseModel):
    content: str = Field(min_length=1, max_length=10000)


class MessageOut(BaseModel):
    model_config = ConfigDict(from_attributes=True)

    id: int
    conversation_id: int
    sender_id: int | None
    sender: UserBrief | None
    client_message_id: str
    content: str | None
    message_type: MessageType
    status: MessageStatus
    delivery_state: DeliveryState
    attachments: list[MessageAttachmentOut]
    queued_at: datetime | None
    persisted_at: datetime | None
    delivered_at: datetime | None
    read_at: datetime | None
    delivery_updated_at: datetime | None
    created_at: datetime
    edited_at: datetime | None
    deleted_at: datetime | None


class ReadReceiptOut(BaseModel):
    id: int
    message_id: int
    conversation_id: int
    user_id: int
    read_at: datetime


class DeliveryReceiptOut(BaseModel):
    id: int
    message_id: int
    user_id: int
    state: DeliveryState
    queued_at: datetime | None
    persisted_at: datetime | None
    delivered_at: datetime
    read_at: datetime | None
    updated_at: datetime


class MessageSearchOut(BaseModel):
    message: MessageOut
    rank: float


class PresignedUploadRequest(BaseModel):
    filename: str = Field(min_length=1, max_length=255)
    content_type: str = Field(min_length=1, max_length=255)
    size_bytes: int = Field(gt=0)


class PresignedUploadResponse(BaseModel):
    upload_url: str
    bucket: str
    object_key: str
    expires_in: int
    content_type: str
    size_bytes: int
    public_url: str | None = None


class LocalUploadResponse(BaseModel):
    bucket: str
    object_key: str
    original_name: str
    mime_type: str
    size_bytes: int
    public_url: str
