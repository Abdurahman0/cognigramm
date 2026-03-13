from __future__ import annotations

from datetime import datetime
from enum import Enum
from typing import TYPE_CHECKING

from sqlalchemy import JSON, DateTime, Enum as SAEnum, ForeignKey, String, Text, func
from sqlalchemy.orm import Mapped, mapped_column, relationship

from app.database.base import Base

if TYPE_CHECKING:
    from app.conversations.models import ConversationParticipant
    from app.messages.models import Message, MessageDeliveryReceipt, MessageReadReceipt


class UserStatus(str, Enum):
    available = "available"
    in_meeting = "in_meeting"
    busy = "busy"
    on_break = "on_break"
    offline = "offline"
    remote = "remote"


class Role(Base):
    __tablename__ = "roles"

    id: Mapped[int] = mapped_column(primary_key=True)
    code: Mapped[str] = mapped_column(String(50), unique=True, index=True, nullable=False)
    name: Mapped[str] = mapped_column(String(100), unique=True, nullable=False)
    permissions_json: Mapped[dict] = mapped_column(JSON, nullable=False, default=dict)
    created_at: Mapped[datetime] = mapped_column(
        DateTime(timezone=True),
        server_default=func.now(),
        nullable=False,
    )


class Department(Base):
    __tablename__ = "departments"

    id: Mapped[int] = mapped_column(primary_key=True)
    name: Mapped[str] = mapped_column(String(100), unique=True, index=True, nullable=False)
    created_at: Mapped[datetime] = mapped_column(
        DateTime(timezone=True),
        server_default=func.now(),
        nullable=False,
    )


class User(Base):
    __tablename__ = "users"

    id: Mapped[int] = mapped_column(primary_key=True)
    username: Mapped[str] = mapped_column(String(50), unique=True, index=True, nullable=False)
    email: Mapped[str] = mapped_column(String(255), unique=True, index=True, nullable=False)
    password_hash: Mapped[str] = mapped_column(String(255), nullable=False)
    full_name: Mapped[str | None] = mapped_column(String(255), nullable=True)
    avatar_url: Mapped[str | None] = mapped_column(String(2048), nullable=True)
    role_id: Mapped[int | None] = mapped_column(
        ForeignKey("roles.id", ondelete="SET NULL"),
        nullable=True,
        index=True,
    )
    department_id: Mapped[int | None] = mapped_column(
        ForeignKey("departments.id", ondelete="SET NULL"),
        nullable=True,
        index=True,
    )
    title: Mapped[str | None] = mapped_column(String(255), nullable=True)
    about: Mapped[str | None] = mapped_column(Text, nullable=True)
    timezone: Mapped[str] = mapped_column(String(64), nullable=False, default="UTC")
    phone: Mapped[str | None] = mapped_column(String(32), nullable=True)
    handle: Mapped[str | None] = mapped_column(String(64), nullable=True, unique=True, index=True)
    office_location: Mapped[str | None] = mapped_column(String(255), nullable=True)
    manager_id: Mapped[int | None] = mapped_column(
        ForeignKey("users.id", ondelete="SET NULL"),
        nullable=True,
        index=True,
    )
    last_seen_at: Mapped[datetime | None] = mapped_column(DateTime(timezone=True), nullable=True)
    status: Mapped[UserStatus] = mapped_column(
        SAEnum(UserStatus, name="user_status"),
        nullable=False,
        default=UserStatus.available,
    )
    created_at: Mapped[datetime] = mapped_column(
        DateTime(timezone=True),
        server_default=func.now(),
        nullable=False,
    )

    role: Mapped["Role | None"] = relationship()
    department: Mapped["Department | None"] = relationship()
    manager: Mapped["User | None"] = relationship(
        remote_side=[id],
        back_populates="direct_reports",
        foreign_keys=[manager_id],
    )
    direct_reports: Mapped[list["User"]] = relationship(
        back_populates="manager",
        foreign_keys=[manager_id],
    )
    participants: Mapped[list["ConversationParticipant"]] = relationship(
        back_populates="user",
        cascade="all, delete-orphan",
    )
    sent_messages: Mapped[list["Message"]] = relationship(back_populates="sender")
    message_reads: Mapped[list["MessageReadReceipt"]] = relationship(back_populates="user")
    message_deliveries: Mapped[list["MessageDeliveryReceipt"]] = relationship(back_populates="user")
