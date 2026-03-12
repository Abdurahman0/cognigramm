from datetime import datetime, timezone
from enum import Enum
from typing import Any
from uuid import uuid4

from pydantic import BaseModel, Field

from app.messages.models import MessageType


class QueueEventType(str, Enum):
    create_message = "create_message"
    delivery_ack = "delivery_ack"
    read_ack = "read_ack"
    notification_send = "notification_send"


class AttachmentPayload(BaseModel):
    bucket: str
    object_key: str
    original_name: str
    mime_type: str
    size_bytes: int = Field(gt=0)
    public_url: str | None = None


class MessageIngressEvent(BaseModel):
    event_id: str = Field(default_factory=lambda: str(uuid4()))
    event_type: QueueEventType = QueueEventType.create_message
    user_id: int
    conversation_id: int
    content: str | None = None
    message_type: MessageType
    client_message_id: str
    attachments: list[AttachmentPayload] = Field(default_factory=list)
    queued_at: datetime = Field(default_factory=lambda: datetime.now(timezone.utc))
    retry_count: int = 0


class DeliveryAckIngressEvent(BaseModel):
    event_id: str = Field(default_factory=lambda: str(uuid4()))
    event_type: QueueEventType = QueueEventType.delivery_ack
    user_id: int
    message_id: int
    acked_at: datetime = Field(default_factory=lambda: datetime.now(timezone.utc))
    retry_count: int = 0


class ReadAckIngressEvent(BaseModel):
    event_id: str = Field(default_factory=lambda: str(uuid4()))
    event_type: QueueEventType = QueueEventType.read_ack
    user_id: int
    message_id: int
    acked_at: datetime = Field(default_factory=lambda: datetime.now(timezone.utc))
    retry_count: int = 0


class PushNotificationEvent(BaseModel):
    event_id: str = Field(default_factory=lambda: str(uuid4()))
    event_type: QueueEventType = QueueEventType.notification_send
    user_id: int
    payload: dict[str, Any]
    retry_count: int = 0
