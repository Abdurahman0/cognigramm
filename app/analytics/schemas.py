from datetime import datetime, timezone
from enum import Enum
from typing import Any
from uuid import uuid4

from pydantic import BaseModel, Field


class AnalyticsEventType(str, Enum):
    message_sent = "message_sent"
    message_delivered = "message_delivered"
    message_read = "message_read"
    user_online = "user_online"
    conversation_created = "conversation_created"


class AnalyticsEvent(BaseModel):
    event_id: str = Field(default_factory=lambda: str(uuid4()))
    event_type: AnalyticsEventType
    occurred_at: datetime = Field(default_factory=lambda: datetime.now(timezone.utc))
    user_id: int | None = None
    conversation_id: int | None = None
    message_id: int | None = None
    metadata: dict[str, Any] = Field(default_factory=dict)
    retry_count: int = 0
