from datetime import datetime, timezone

from fastapi import HTTPException, status
from redis.asyncio import Redis
from sqlalchemy import func, select, text
from sqlalchemy.exc import IntegrityError
from sqlalchemy.ext.asyncio import AsyncSession
from sqlalchemy.orm import selectinload

from app.cache.conversation_cache import ConversationCache
from app.config import get_settings
from app.conversations.models import ConversationParticipant
from app.messages.models import (
    DeliveryState,
    Message,
    MessageAttachment,
    MessageDedupKey,
    MessageDeliveryReceipt,
    MessageReadReceipt,
    MessageType,
)
from app.messages.schemas import MessageAttachmentIn, MessageCreateRequest, MessageUpdateRequest


settings = get_settings()
_redis = Redis.from_url(settings.redis_url, decode_responses=True)
_conversation_cache = ConversationCache(_redis)


class MessageService:
    def __init__(self, session: AsyncSession) -> None:
        self.session = session
        self.cache = _conversation_cache

    async def list_messages(
        self,
        conversation_id: int,
        user_id: int,
        limit: int,
        offset: int,
    ) -> list[Message]:
        await self.assert_member(conversation_id, user_id)
        if offset == 0:
            cached = await self.cache.get_recent_messages(conversation_id, limit)
            if cached:
                cached_ids = [int(item["id"]) for item in cached if "id" in item]
                if cached_ids:
                    stmt = (
                        select(Message)
                        .where(
                            Message.conversation_id == conversation_id,
                            Message.id.in_(cached_ids),
                        )
                        .options(selectinload(Message.sender), selectinload(Message.attachments))
                        .order_by(Message.created_at.asc(), Message.id.asc())
                    )
                    result = await self.session.scalars(stmt)
                    messages = list(result.all())
                    if messages:
                        return messages[-limit:]
        stmt = (
            select(Message)
            .where(Message.conversation_id == conversation_id)
            .options(selectinload(Message.sender), selectinload(Message.attachments))
            .order_by(Message.created_at.asc(), Message.id.asc())
            .offset(offset)
            .limit(limit)
        )
        result = await self.session.scalars(stmt)
        messages = list(result.all())
        if offset == 0:
            for message in reversed(messages):
                await self.cache.add_recent_message(conversation_id, self.serialize_message(message))
        return messages

    async def list_messages_after_id(
        self,
        conversation_id: int,
        user_id: int,
        last_message_id: int,
        limit: int,
    ) -> list[Message]:
        await self.assert_member(conversation_id, user_id)
        stmt = (
            select(Message)
            .where(
                Message.conversation_id == conversation_id,
                Message.id > last_message_id,
            )
            .options(selectinload(Message.sender), selectinload(Message.attachments))
            .order_by(Message.id.asc())
            .limit(limit)
        )
        result = await self.session.scalars(stmt)
        return list(result.all())

    async def get_latest_message(self, conversation_id: int, user_id: int) -> Message | None:
        await self.assert_member(conversation_id, user_id)
        stmt = (
            select(Message)
            .where(Message.conversation_id == conversation_id)
            .options(selectinload(Message.sender), selectinload(Message.attachments))
            .order_by(Message.created_at.desc(), Message.id.desc())
            .limit(1)
        )
        return await self.session.scalar(stmt)

    async def search_messages(
        self,
        conversation_id: int,
        user_id: int,
        query_text: str,
        limit: int,
        offset: int,
    ) -> list[tuple[Message, float]]:
        await self.assert_member(conversation_id, user_id)
        ts_vector = func.to_tsvector("simple", func.coalesce(Message.content, ""))
        ts_query = func.plainto_tsquery("simple", query_text)
        rank = func.ts_rank(ts_vector, ts_query).label("rank")
        stmt = (
            select(Message, rank)
            .where(
                Message.conversation_id == conversation_id,
                Message.deleted_at.is_(None),
                ts_vector.op("@@")(ts_query),
            )
            .options(selectinload(Message.sender), selectinload(Message.attachments))
            .order_by(rank.desc(), Message.created_at.desc(), Message.id.desc())
            .offset(offset)
            .limit(limit)
        )
        result = await self.session.execute(stmt)
        return [(row[0], float(row[1])) for row in result.all()]

    async def create_message(self, user_id: int, payload: MessageCreateRequest) -> Message:
        return await self.persist_ingress_message(
            user_id=user_id,
            conversation_id=payload.conversation_id,
            content=payload.content,
            message_type=payload.type,
            client_message_id=payload.client_message_id,
            attachments=payload.attachments,
            queued_at=datetime.now(timezone.utc),
        )

    async def persist_ingress_message(
        self,
        user_id: int,
        conversation_id: int,
        content: str | None,
        message_type: MessageType,
        client_message_id: str,
        attachments: list[MessageAttachmentIn],
        queued_at: datetime,
    ) -> Message:
        await self.assert_member(conversation_id, user_id)
        existing = await self.get_message_by_client_message_id(client_message_id)
        if existing is not None:
            return existing

        normalized_content = content.strip() if content else None
        if message_type == MessageType.text and not normalized_content:
            raise HTTPException(
                status_code=status.HTTP_422_UNPROCESSABLE_ENTITY,
                detail="Text message content cannot be empty",
            )
        if message_type in (MessageType.image, MessageType.file, MessageType.voice) and not attachments:
            raise HTTPException(
                status_code=status.HTTP_422_UNPROCESSABLE_ENTITY,
                detail="Attachment is required for selected message type",
            )

        now = datetime.now(timezone.utc)
        message = Message(
            conversation_id=conversation_id,
            sender_id=user_id,
            content=normalized_content,
            message_type=message_type,
            client_message_id=client_message_id,
            delivery_state=DeliveryState.persisted,
            queued_at=queued_at,
            persisted_at=now,
            delivery_updated_at=now,
        )
        self.session.add(message)
        await self.session.flush()

        dedup_key = MessageDedupKey(
            client_message_id=client_message_id,
            conversation_id=conversation_id,
            user_id=user_id,
            message_id=message.id,
        )
        self.session.add(dedup_key)

        for attachment in attachments:
            self.session.add(
                MessageAttachment(
                    message_id=message.id,
                    bucket=attachment.bucket,
                    object_key=attachment.object_key,
                    original_name=attachment.original_name,
                    mime_type=attachment.mime_type,
                    size_bytes=attachment.size_bytes,
                    public_url=attachment.public_url,
                )
            )

        participants = await self.get_conversation_participant_ids(conversation_id)
        for participant_id in participants:
            if participant_id == user_id:
                continue
            self.session.add(
                MessageDeliveryReceipt(
                    message_id=message.id,
                    user_id=participant_id,
                    state=DeliveryState.persisted,
                    queued_at=queued_at,
                    persisted_at=now,
                    updated_at=now,
                )
            )

        try:
            await self.session.commit()
        except IntegrityError:
            await self.session.rollback()
            existing_after_race = await self.get_message_by_client_message_id(client_message_id)
            if existing_after_race is not None:
                return existing_after_race
            raise
        refreshed = await self._get_message(message.id)
        if refreshed is None:
            raise HTTPException(status_code=status.HTTP_404_NOT_FOUND, detail="Message not found")
        await self.cache.add_recent_message(conversation_id, self.serialize_message(refreshed))
        return refreshed

    async def edit_message(self, message_id: int, user_id: int, payload: MessageUpdateRequest) -> Message:
        message = await self._get_message(message_id)
        if message is None:
            raise HTTPException(status_code=status.HTTP_404_NOT_FOUND, detail="Message not found")
        await self.assert_member(message.conversation_id, user_id)
        if message.sender_id != user_id:
            raise HTTPException(status_code=status.HTTP_403_FORBIDDEN, detail="Only sender can edit message")
        if message.deleted_at is not None:
            raise HTTPException(status_code=status.HTTP_400_BAD_REQUEST, detail="Cannot edit deleted message")

        message.content = payload.content.strip()
        message.edited_at = datetime.now(timezone.utc)
        await self.session.commit()
        refreshed = await self._get_message(message.id)
        if refreshed is None:
            raise HTTPException(status_code=status.HTTP_404_NOT_FOUND, detail="Message not found")
        await self.cache.invalidate_conversation(message.conversation_id)
        return refreshed

    async def delete_message(self, message_id: int, user_id: int) -> Message:
        message = await self._get_message(message_id)
        if message is None:
            raise HTTPException(status_code=status.HTTP_404_NOT_FOUND, detail="Message not found")
        await self.assert_member(message.conversation_id, user_id)
        if message.sender_id != user_id:
            raise HTTPException(status_code=status.HTTP_403_FORBIDDEN, detail="Only sender can delete message")
        if message.deleted_at is not None:
            return message

        message.deleted_at = datetime.now(timezone.utc)
        message.content = None
        await self.session.commit()
        refreshed = await self._get_message(message.id)
        if refreshed is None:
            raise HTTPException(status_code=status.HTTP_404_NOT_FOUND, detail="Message not found")
        await self.cache.invalidate_conversation(message.conversation_id)
        return refreshed

    async def mark_read(self, message_id: int, user_id: int) -> tuple[MessageReadReceipt, int]:
        message = await self._get_message(message_id)
        if message is None:
            raise HTTPException(status_code=status.HTTP_404_NOT_FOUND, detail="Message not found")
        await self.assert_member(message.conversation_id, user_id)
        now = datetime.now(timezone.utc)

        receipt_stmt = select(MessageReadReceipt).where(
            MessageReadReceipt.message_id == message_id,
            MessageReadReceipt.user_id == user_id,
        )
        receipt = await self.session.scalar(receipt_stmt)
        if receipt is None:
            receipt = MessageReadReceipt(message_id=message_id, user_id=user_id, read_at=now)
            self.session.add(receipt)

        delivery_stmt = select(MessageDeliveryReceipt).where(
            MessageDeliveryReceipt.message_id == message_id,
            MessageDeliveryReceipt.user_id == user_id,
        )
        delivery = await self.session.scalar(delivery_stmt)
        if delivery is not None:
            delivery.state = DeliveryState.read
            delivery.read_at = now
            delivery.delivered_at = delivery.delivered_at or now
            delivery.updated_at = now
        await self._recalculate_message_delivery_state(message.id)
        await self.session.commit()
        return receipt, message.conversation_id

    async def mark_delivered(self, message_id: int, user_id: int) -> tuple[MessageDeliveryReceipt, int]:
        message = await self._get_message(message_id)
        if message is None:
            raise HTTPException(status_code=status.HTTP_404_NOT_FOUND, detail="Message not found")
        await self.assert_member(message.conversation_id, user_id)
        now = datetime.now(timezone.utc)
        receipt_stmt = select(MessageDeliveryReceipt).where(
            MessageDeliveryReceipt.message_id == message_id,
            MessageDeliveryReceipt.user_id == user_id,
        )
        receipt = await self.session.scalar(receipt_stmt)
        if receipt is None:
            receipt = MessageDeliveryReceipt(
                message_id=message_id,
                user_id=user_id,
                state=DeliveryState.delivered,
                queued_at=message.queued_at,
                persisted_at=message.persisted_at,
                delivered_at=now,
                updated_at=now,
            )
            self.session.add(receipt)
        else:
            if receipt.state == DeliveryState.read:
                await self.session.flush()
                return receipt, message.conversation_id
            receipt.state = DeliveryState.delivered
            receipt.delivered_at = receipt.delivered_at or now
            receipt.updated_at = now
        await self._recalculate_message_delivery_state(message.id)
        await self.session.commit()
        await self.session.refresh(receipt)
        return receipt, message.conversation_id

    async def list_delivery_receipts(self, message_id: int, user_id: int) -> list[MessageDeliveryReceipt]:
        message = await self._get_message(message_id)
        if message is None:
            raise HTTPException(status_code=status.HTTP_404_NOT_FOUND, detail="Message not found")
        await self.assert_member(message.conversation_id, user_id)
        stmt = (
            select(MessageDeliveryReceipt)
            .where(MessageDeliveryReceipt.message_id == message_id)
            .order_by(MessageDeliveryReceipt.user_id.asc())
        )
        result = await self.session.scalars(stmt)
        return list(result.all())

    async def get_message_by_client_message_id(self, client_message_id: str) -> Message | None:
        dedup = await self.session.get(MessageDedupKey, client_message_id)
        if dedup is None or dedup.message_id is None:
            return None
        return await self._get_message(dedup.message_id)

    async def get_message_by_id(self, message_id: int) -> Message | None:
        return await self._get_message(message_id)

    async def get_conversation_participant_ids(self, conversation_id: int) -> list[int]:
        stmt = select(ConversationParticipant.user_id).where(
            ConversationParticipant.conversation_id == conversation_id
        )
        result = await self.session.scalars(stmt)
        return list(result.all())

    async def assert_member(self, conversation_id: int, user_id: int) -> None:
        stmt = select(ConversationParticipant.id).where(
            ConversationParticipant.conversation_id == conversation_id,
            ConversationParticipant.user_id == user_id,
        )
        participant_id = await self.session.scalar(stmt)
        if participant_id is None:
            raise HTTPException(status_code=status.HTTP_403_FORBIDDEN, detail="Not a conversation member")

    async def ensure_partitions(self, months_ahead: int = 6) -> None:
        await self.session.execute(
            text("SELECT ensure_messages_partitions(:months_ahead)"),
            {"months_ahead": months_ahead},
        )
        await self.session.commit()

    async def _recalculate_message_delivery_state(self, message_id: int) -> None:
        message = await self._get_message(message_id)
        if message is None:
            return
        now = datetime.now(timezone.utc)
        stmt = select(MessageDeliveryReceipt.state).where(MessageDeliveryReceipt.message_id == message_id)
        states = list((await self.session.scalars(stmt)).all())
        if not states:
            message.delivery_state = DeliveryState.persisted
            message.delivery_updated_at = now
            return
        if all(state == DeliveryState.read for state in states):
            message.delivery_state = DeliveryState.read
            message.read_at = now
            message.delivered_at = message.delivered_at or now
        elif all(state in {DeliveryState.delivered, DeliveryState.read} for state in states):
            message.delivery_state = DeliveryState.delivered
            message.delivered_at = now
        else:
            message.delivery_state = DeliveryState.persisted
        message.delivery_updated_at = now

    async def _get_message(self, message_id: int) -> Message | None:
        stmt = (
            select(Message)
            .where(Message.id == message_id)
            .options(
                selectinload(Message.sender),
                selectinload(Message.attachments),
                selectinload(Message.delivery_receipts),
            )
        )
        return await self.session.scalar(stmt)

    @staticmethod
    def serialize_message(message: Message) -> dict:
        sender = None
        if message.sender is not None:
            sender = {"id": message.sender.id, "username": message.sender.username}
        attachments = [
            {
                "id": item.id,
                "bucket": item.bucket,
                "object_key": item.object_key,
                "original_name": item.original_name,
                "mime_type": item.mime_type,
                "size_bytes": item.size_bytes,
                "public_url": item.public_url,
                "created_at": item.created_at.isoformat() if item.created_at else None,
            }
            for item in message.attachments
        ]
        return {
            "id": message.id,
            "conversation_id": message.conversation_id,
            "sender_id": message.sender_id,
            "sender": sender,
            "client_message_id": message.client_message_id,
            "content": message.content,
            "message_type": message.message_type.value,
            "status": message.status.value,
            "delivery_state": message.delivery_state.value,
            "attachments": attachments,
            "queued_at": message.queued_at.isoformat() if message.queued_at else None,
            "persisted_at": message.persisted_at.isoformat() if message.persisted_at else None,
            "delivered_at": message.delivered_at.isoformat() if message.delivered_at else None,
            "read_at": message.read_at.isoformat() if message.read_at else None,
            "delivery_updated_at": message.delivery_updated_at.isoformat() if message.delivery_updated_at else None,
            "created_at": message.created_at.isoformat() if message.created_at else None,
            "edited_at": message.edited_at.isoformat() if message.edited_at else None,
            "deleted_at": message.deleted_at.isoformat() if message.deleted_at else None,
        }
