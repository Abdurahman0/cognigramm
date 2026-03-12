from __future__ import annotations

from datetime import date, datetime
from enum import Enum

from sqlalchemy import BigInteger, Date, DateTime, Enum as SAEnum, Integer, JSON, String, UniqueConstraint, func
from sqlalchemy.orm import Mapped, mapped_column

from app.database.base import Base


class AnalyticsEventTypeDB(str, Enum):
    message_sent = "message_sent"
    message_delivered = "message_delivered"
    message_read = "message_read"
    user_online = "user_online"
    conversation_created = "conversation_created"


class AnalyticsEventRecord(Base):
    __tablename__ = "analytics_events"

    id: Mapped[int] = mapped_column(primary_key=True)
    event_id: Mapped[str] = mapped_column(String(64), nullable=False, unique=True, index=True)
    event_type: Mapped[AnalyticsEventTypeDB] = mapped_column(
        SAEnum(AnalyticsEventTypeDB, name="analytics_event_type"),
        nullable=False,
        index=True,
    )
    user_id: Mapped[int | None] = mapped_column(nullable=True, index=True)
    conversation_id: Mapped[int | None] = mapped_column(nullable=True, index=True)
    message_id: Mapped[int | None] = mapped_column(BigInteger, nullable=True, index=True)
    occurred_at: Mapped[datetime] = mapped_column(DateTime(timezone=True), nullable=False, index=True)
    event_metadata: Mapped[dict] = mapped_column("metadata", JSON, nullable=False, default=dict)
    created_at: Mapped[datetime] = mapped_column(DateTime(timezone=True), server_default=func.now(), nullable=False)


class AnalyticsDailyMetric(Base):
    __tablename__ = "analytics_daily_metrics"
    __table_args__ = (
        UniqueConstraint("metric_date", "metric_name", "dimension_key", name="uq_analytics_daily_metrics_dim"),
    )

    id: Mapped[int] = mapped_column(primary_key=True)
    metric_date: Mapped[date] = mapped_column(Date, nullable=False, index=True)
    metric_name: Mapped[str] = mapped_column(String(128), nullable=False, index=True)
    dimension_key: Mapped[str] = mapped_column(String(255), nullable=False, default="global")
    metric_value: Mapped[int] = mapped_column(Integer, nullable=False, default=0)
    updated_at: Mapped[datetime] = mapped_column(DateTime(timezone=True), server_default=func.now(), nullable=False)


class AnalyticsDailyUserActivity(Base):
    __tablename__ = "analytics_daily_user_activity"
    __table_args__ = (
        UniqueConstraint("metric_date", "user_id", name="uq_analytics_daily_user_activity_user"),
    )

    id: Mapped[int] = mapped_column(primary_key=True)
    metric_date: Mapped[date] = mapped_column(Date, nullable=False, index=True)
    user_id: Mapped[int] = mapped_column(nullable=False, index=True)
    first_seen_at: Mapped[datetime] = mapped_column(DateTime(timezone=True), nullable=False)


class AnalyticsDailyConversationActivity(Base):
    __tablename__ = "analytics_daily_conversation_activity"
    __table_args__ = (
        UniqueConstraint("metric_date", "conversation_id", name="uq_analytics_daily_conversation_activity_conv"),
    )

    id: Mapped[int] = mapped_column(primary_key=True)
    metric_date: Mapped[date] = mapped_column(Date, nullable=False, index=True)
    conversation_id: Mapped[int] = mapped_column(nullable=False, index=True)
    first_activity_at: Mapped[datetime] = mapped_column(DateTime(timezone=True), nullable=False)
