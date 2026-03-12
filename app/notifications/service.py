import logging
from typing import Any


logger = logging.getLogger("push_notifications")


class PushNotificationService:
    async def send(self, user_id: int, payload: dict[str, Any]) -> None:
        logger.info("push_notification_sent user_id=%s payload=%s", user_id, payload)
