from __future__ import annotations

from datetime import datetime
from typing import TYPE_CHECKING

from sqlalchemy import DateTime, String, func
from sqlalchemy.orm import Mapped, mapped_column, relationship

from app.database.base import Base

if TYPE_CHECKING:
    from app.conversations.models import ConversationParticipant
    from app.messages.models import Message, MessageDeliveryReceipt, MessageReadReceipt


class User(Base):
    __tablename__ = "users"

    id: Mapped[int] = mapped_column(primary_key=True)
    username: Mapped[str] = mapped_column(String(50), unique=True, index=True, nullable=False)
    email: Mapped[str] = mapped_column(String(255), unique=True, index=True, nullable=False)
    password_hash: Mapped[str] = mapped_column(String(255), nullable=False)
    created_at: Mapped[datetime] = mapped_column(
        DateTime(timezone=True),
        server_default=func.now(),
        nullable=False,
    )

    participants: Mapped[list["ConversationParticipant"]] = relationship(
        back_populates="user",
        cascade="all, delete-orphan",
    )
    sent_messages: Mapped[list["Message"]] = relationship(back_populates="sender")
    message_reads: Mapped[list["MessageReadReceipt"]] = relationship(back_populates="user")
    message_deliveries: Mapped[list["MessageDeliveryReceipt"]] = relationship(back_populates="user")
