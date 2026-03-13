from datetime import datetime

from pydantic import BaseModel, ConfigDict, EmailStr, Field

from app.users.models import UserStatus


class UserOut(BaseModel):
    model_config = ConfigDict(from_attributes=True)

    id: int
    username: str
    email: EmailStr
    full_name: str | None = None
    avatar_url: str | None = None
    role_id: int | None = None
    department_id: int | None = None
    title: str | None = None
    about: str | None = None
    timezone: str
    phone: str | None = None
    handle: str | None = None
    office_location: str | None = None
    manager_id: int | None = None
    last_seen_at: datetime | None = None
    status: UserStatus
    created_at: datetime


class UserBrief(BaseModel):
    model_config = ConfigDict(from_attributes=True)

    id: int
    username: str


class UserUpdateRequest(BaseModel):
    full_name: str | None = Field(default=None, max_length=255)
    avatar_url: str | None = Field(default=None, max_length=2048)
    role_id: int | None = None
    department_id: int | None = None
    title: str | None = Field(default=None, max_length=255)
    about: str | None = Field(default=None, max_length=4000)
    timezone: str | None = Field(default=None, max_length=64)
    phone: str | None = Field(default=None, max_length=32)
    handle: str | None = Field(default=None, max_length=64)
    office_location: str | None = Field(default=None, max_length=255)
    manager_id: int | None = None
    status: UserStatus | None = None
    last_seen_at: datetime | None = None


class UserStatusUpdateRequest(BaseModel):
    status: UserStatus
