from datetime import datetime

from pydantic import BaseModel, ConfigDict, Field

from app.conversations.models import ConversationType, ParticipantRole


class ConversationCreateRequest(BaseModel):
    type: ConversationType
    title: str | None = Field(default=None, max_length=255)
    participant_ids: list[int] = Field(default_factory=list)


class ConversationMemberOut(BaseModel):
    model_config = ConfigDict(from_attributes=True)

    user_id: int
    username: str
    role: ParticipantRole
    joined_at: datetime


class ConversationOut(BaseModel):
    id: int
    type: ConversationType
    title: str | None
    created_at: datetime
    participants: list[ConversationMemberOut]


class AddMembersRequest(BaseModel):
    user_ids: list[int] = Field(min_length=1)
