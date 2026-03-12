from functools import lru_cache

from pydantic import Field, field_validator
from pydantic_settings import BaseSettings, SettingsConfigDict


class Settings(BaseSettings):
    model_config = SettingsConfigDict(env_file=".env", env_file_encoding="utf-8", case_sensitive=False)

    app_name: str = "Messenger Backend"
    debug: bool = False
    cors_origins: list[str] = Field(default_factory=lambda: ["*"])

    database_url: str = "postgresql+asyncpg://postgres:postgres@localhost:5432/messenger"
    redis_url: str = "redis://localhost:6379/0"
    rabbitmq_url: str = "amqp://guest:guest@localhost:5672/"
    db_pool_size: int = 20
    db_max_overflow: int = 40

    jwt_secret_key: str = "change_me"
    jwt_algorithm: str = "HS256"
    jwt_access_token_expire_minutes: int = 60

    message_rate_limit_per_second: int = 8
    message_queue_name: str = "messaging.events"
    notification_queue_name: str = "notification.events"
    analytics_queue_name: str = "analytics.events"
    worker_retry_limit: int = 5

    s3_endpoint_url: str | None = None
    s3_region: str = "us-east-1"
    s3_access_key_id: str = "minioadmin"
    s3_secret_access_key: str = "minioadmin"
    s3_bucket_name: str = "messenger-files"
    s3_presign_expire_seconds: int = 900
    local_media_dir: str = "media"
    local_media_base_url: str | None = None

    presence_session_ttl_seconds: int = 120
    presence_typing_ttl_seconds: int = 8
    presence_cleanup_interval_seconds: int = 20
    conversation_cache_ttl_seconds: int = 600
    conversation_recent_messages_limit: int = 200
    websocket_instance_id: str = "ws-1"

    @field_validator("cors_origins", mode="before")
    @classmethod
    def parse_cors_origins(cls, value: str | list[str]) -> list[str]:
        if isinstance(value, str):
            return [item.strip() for item in value.split(",") if item.strip()]
        return value


@lru_cache
def get_settings() -> Settings:
    return Settings()
