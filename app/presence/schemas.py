from datetime import datetime

from pydantic import BaseModel, Field


class PresenceConnectPayload(BaseModel):
    session_id: str = Field(min_length=8, max_length=64)
    device_id: str | None = Field(default=None, max_length=128)
    active_conversation_id: int | None = None


class PresenceStateOut(BaseModel):
    user_id: int
    is_online: bool
    active_conversation_id: int | None = None
    sessions: int
    last_seen: datetime | None = None
    updated_at: datetime | None = None


class TypingStateOut(BaseModel):
    conversation_id: int
    user_ids: list[int]


class SetActiveConversationRequest(BaseModel):
    conversation_id: int | None = None
