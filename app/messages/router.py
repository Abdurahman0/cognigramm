from pathlib import Path
from urllib.parse import quote
from uuid import uuid4

from fastapi import APIRouter, Depends, File, HTTPException, Query, Request, UploadFile, status
from sqlalchemy.ext.asyncio import AsyncSession

from app.config import get_settings
from app.core.dependencies import get_current_user
from app.database.session import get_db_session
from app.analytics.publisher import AnalyticsPublisher
from app.analytics.schemas import AnalyticsEvent, AnalyticsEventType
from app.messages.schemas import (
    DeliveryReceiptOut,
    LocalUploadResponse,
    MessageOut,
    MessageSearchOut,
    MessageUpdateRequest,
    PresignedUploadRequest,
    PresignedUploadResponse,
    ReadReceiptOut,
)
from app.messages.service import MessageService
from app.redis.pubsub import RedisPubSub
from app.storage.service import StorageService
from app.users.models import User


router = APIRouter(tags=["messages"])
settings = get_settings()
storage_service = StorageService(settings)
event_pubsub = RedisPubSub(settings.redis_url)
analytics_publisher = AnalyticsPublisher()


async def close_message_router_resources() -> None:
    await event_pubsub.redis.aclose()
    await analytics_publisher.close()


@router.get("/conversations/{conversation_id}/messages", response_model=list[MessageOut])
async def get_message_history(
    conversation_id: int,
    limit: int = Query(default=50, ge=1, le=100),
    offset: int = Query(default=0, ge=0),
    current_user: User = Depends(get_current_user),
    session: AsyncSession = Depends(get_db_session),
) -> list[MessageOut]:
    service = MessageService(session)
    messages = await service.list_messages(conversation_id, current_user.id, limit, offset)
    return [MessageOut.model_validate(message) for message in messages]


@router.get("/conversations/{conversation_id}/messages/search", response_model=list[MessageSearchOut])
async def search_messages(
    conversation_id: int,
    q: str = Query(min_length=1, max_length=200),
    limit: int = Query(default=25, ge=1, le=100),
    offset: int = Query(default=0, ge=0),
    current_user: User = Depends(get_current_user),
    session: AsyncSession = Depends(get_db_session),
) -> list[MessageSearchOut]:
    service = MessageService(session)
    results = await service.search_messages(conversation_id, current_user.id, q, limit, offset)
    return [MessageSearchOut(message=MessageOut.model_validate(item[0]), rank=item[1]) for item in results]


@router.patch("/messages/{message_id}", response_model=MessageOut)
async def edit_message(
    message_id: int,
    payload: MessageUpdateRequest,
    current_user: User = Depends(get_current_user),
    session: AsyncSession = Depends(get_db_session),
) -> MessageOut:
    service = MessageService(session)
    message = await service.edit_message(message_id, current_user.id, payload)
    return MessageOut.model_validate(message)


@router.delete("/messages/{message_id}", response_model=MessageOut)
async def delete_message(
    message_id: int,
    current_user: User = Depends(get_current_user),
    session: AsyncSession = Depends(get_db_session),
) -> MessageOut:
    service = MessageService(session)
    message = await service.delete_message(message_id, current_user.id)
    return MessageOut.model_validate(message)


@router.post("/messages/{message_id}/read", response_model=ReadReceiptOut)
async def mark_message_as_read(
    message_id: int,
    current_user: User = Depends(get_current_user),
    session: AsyncSession = Depends(get_db_session),
) -> ReadReceiptOut:
    service = MessageService(session)
    receipt, conversation_id = await service.mark_read(message_id, current_user.id)
    await event_pubsub.publish_conversation_event(
        conversation_id=conversation_id,
        event="message_read",
        payload={
            "message_id": receipt.message_id,
            "user_id": receipt.user_id,
            "read_at": receipt.read_at.isoformat(),
        },
    )
    message = await service.get_message_by_id(message_id)
    if message is not None:
        await event_pubsub.publish_conversation_event(
            conversation_id=conversation_id,
            event="message_delivery_state",
            payload={
                "message_id": message.id,
                "state": message.delivery_state.value,
                "updated_at": message.delivery_updated_at.isoformat() if message.delivery_updated_at else None,
            },
        )
    try:
        await analytics_publisher.publish(
            AnalyticsEvent(
                event_type=AnalyticsEventType.message_read,
                user_id=current_user.id,
                conversation_id=conversation_id,
                message_id=message_id,
            )
        )
    except Exception:
        pass
    return ReadReceiptOut(
        id=receipt.id,
        message_id=receipt.message_id,
        conversation_id=conversation_id,
        user_id=receipt.user_id,
        read_at=receipt.read_at,
    )


@router.get("/messages/{message_id}/delivery", response_model=list[DeliveryReceiptOut])
async def get_message_delivery(
    message_id: int,
    current_user: User = Depends(get_current_user),
    session: AsyncSession = Depends(get_db_session),
) -> list[DeliveryReceiptOut]:
    service = MessageService(session)
    receipts = await service.list_delivery_receipts(message_id, current_user.id)
    return [
        DeliveryReceiptOut(
            id=item.id,
            message_id=item.message_id,
            user_id=item.user_id,
            state=item.state,
            queued_at=item.queued_at,
            persisted_at=item.persisted_at,
            delivered_at=item.delivered_at or item.updated_at,
            read_at=item.read_at,
            updated_at=item.updated_at,
        )
        for item in receipts
    ]


@router.post("/files/presign", response_model=PresignedUploadResponse)
async def create_upload_url(
    payload: PresignedUploadRequest,
    current_user: User = Depends(get_current_user),
) -> PresignedUploadResponse:
    result = storage_service.generate_presigned_upload(
        user_id=current_user.id,
        filename=payload.filename,
        content_type=payload.content_type,
        size_bytes=payload.size_bytes,
    )
    return PresignedUploadResponse.model_validate(result)


@router.post("/files/upload-local", response_model=LocalUploadResponse)
async def upload_local_file(
    request: Request,
    file: UploadFile = File(...),
    current_user: User = Depends(get_current_user),
) -> LocalUploadResponse:
    max_size_bytes = 25 * 1024 * 1024
    original_name = file.filename or "file.bin"
    safe_name = Path(original_name).name.replace(" ", "_")
    object_key = f"u/{current_user.id}/{uuid4()}-{safe_name}"
    media_root = Path(settings.local_media_dir)
    destination = media_root / object_key
    destination.parent.mkdir(parents=True, exist_ok=True)

    size_bytes = 0
    try:
        with destination.open("wb") as output:
            while True:
                chunk = await file.read(1024 * 1024)
                if not chunk:
                    break
                size_bytes += len(chunk)
                if size_bytes > max_size_bytes:
                    output.close()
                    destination.unlink(missing_ok=True)
                    raise HTTPException(
                        status_code=status.HTTP_413_REQUEST_ENTITY_TOO_LARGE,
                        detail="File is too large",
                    )
                output.write(chunk)
    finally:
        await file.close()

    base_url = settings.local_media_base_url.rstrip("/") if settings.local_media_base_url else str(request.base_url).rstrip("/")
    public_url = f"{base_url}/media/{quote(object_key, safe='/')}"
    mime_type = file.content_type or "application/octet-stream"
    return LocalUploadResponse(
        bucket="local-media",
        object_key=object_key,
        original_name=original_name,
        mime_type=mime_type,
        size_bytes=size_bytes,
        public_url=public_url,
    )
