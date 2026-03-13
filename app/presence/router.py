from fastapi import APIRouter, Depends, Query
from sqlalchemy.ext.asyncio import AsyncSession

from app.conversations.service import ConversationService
from app.core.dependencies import get_current_user
from app.database.session import get_db_session
from app.presence.schemas import PresenceStateOut, SetActiveConversationRequest, TypingStateOut
from app.presence.service import PresenceService
from app.redis.pubsub import RedisPubSub
from app.users.models import User


def get_presence_router(pubsub: RedisPubSub) -> APIRouter:
    router = APIRouter(prefix="/presence", tags=["presence"])

    @router.get("/users/online", response_model=list[int])
    async def get_online_users(
        limit: int = Query(default=5000, ge=1, le=10000),
        _: User = Depends(get_current_user),
    ) -> list[int]:
        service = PresenceService(pubsub.redis)
        return await service.list_online_users(limit)

    @router.get("/users/{user_id}", response_model=PresenceStateOut)
    async def get_user_presence(
        user_id: int,
        _: User = Depends(get_current_user),
    ) -> PresenceStateOut:
        service = PresenceService(pubsub.redis)
        return await service.get_user_presence(user_id)

    @router.get("/conversations/{conversation_id}/typing", response_model=TypingStateOut)
    async def get_typing_users(
        conversation_id: int,
        current_user: User = Depends(get_current_user),
        session: AsyncSession = Depends(get_db_session),
    ) -> TypingStateOut:
        conversation_service = ConversationService(session)
        await conversation_service.assert_member(conversation_id, current_user.id)
        service = PresenceService(pubsub.redis)
        user_ids = await service.get_typing_users(conversation_id)
        return TypingStateOut(conversation_id=conversation_id, user_ids=user_ids)

    @router.post("/active-conversation", response_model=PresenceStateOut)
    async def set_active_conversation(
        payload: SetActiveConversationRequest,
        current_user: User = Depends(get_current_user),
    ) -> PresenceStateOut:
        service = PresenceService(pubsub.redis)
        state = await service.set_active_conversation(current_user.id, payload.conversation_id)
        await pubsub.publish_presence_event(
            "last_seen_update",
            {
                "user_id": current_user.id,
                "active_conversation_id": state.active_conversation_id,
                "last_seen": state.last_seen.isoformat() if state.last_seen else None,
            },
        )
        return state

    return router
