from fastapi import HTTPException, status
from redis.asyncio import Redis
from sqlalchemy import distinct, func, select
from sqlalchemy.ext.asyncio import AsyncSession
from sqlalchemy.orm import selectinload

from app.analytics.publisher import AnalyticsPublisher
from app.analytics.schemas import AnalyticsEvent, AnalyticsEventType
from app.cache.conversation_cache import ConversationCache
from app.config import get_settings
from app.conversations.models import Conversation, ConversationParticipant, ConversationType, ParticipantRole
from app.conversations.schemas import ConversationCreateRequest
from app.users.models import User


settings = get_settings()
_redis = Redis.from_url(settings.redis_url, decode_responses=True)
_conversation_cache = ConversationCache(_redis)
_analytics_publisher = AnalyticsPublisher()


class ConversationService:
    def __init__(self, session: AsyncSession) -> None:
        self.session = session
        self.cache = _conversation_cache
        self.analytics = _analytics_publisher

    async def create_conversation(
        self,
        creator_id: int,
        payload: ConversationCreateRequest,
    ) -> Conversation:
        participant_ids = set(payload.participant_ids)
        participant_ids.add(creator_id)

        await self._ensure_users_exist(participant_ids)

        if payload.type == ConversationType.direct:
            if len(participant_ids) != 2:
                raise HTTPException(
                    status_code=status.HTTP_422_UNPROCESSABLE_ENTITY,
                    detail="Direct conversations require exactly two unique users",
                )
            existing = await self._find_existing_direct_conversation(participant_ids)
            if existing is not None:
                return existing

        if payload.type == ConversationType.group and (payload.title is None or not payload.title.strip()):
            raise HTTPException(
                status_code=status.HTTP_422_UNPROCESSABLE_ENTITY,
                detail="Group title is required",
            )

        conversation = Conversation(
            type=payload.type,
            title=payload.title.strip() if payload.title else None,
        )
        self.session.add(conversation)
        await self.session.flush()

        for user_id in participant_ids:
            role = ParticipantRole.member
            if payload.type == ConversationType.group and user_id == creator_id:
                role = ParticipantRole.admin
            participant = ConversationParticipant(
                conversation_id=conversation.id,
                user_id=user_id,
                role=role,
            )
            self.session.add(participant)

        await self.session.commit()
        created = await self.get_conversation_or_404(conversation.id, creator_id)
        await self._warm_cache_for_conversation(created)
        for user_id in participant_ids:
            await self.cache.invalidate_user_conversations(user_id)
        await self._publish_analytics_event(
            AnalyticsEvent(
                event_type=AnalyticsEventType.conversation_created,
                user_id=creator_id,
                conversation_id=created.id,
                metadata={"type": created.type.value},
            )
        )
        return created

    async def list_conversations(self, user_id: int, limit: int, offset: int) -> list[Conversation]:
        if offset == 0:
            cached_ids = await self.cache.get_user_conversation_ids(user_id, limit=limit)
            if cached_ids:
                stmt = (
                    select(Conversation)
                    .where(Conversation.id.in_(cached_ids))
                    .join(ConversationParticipant, ConversationParticipant.conversation_id == Conversation.id)
                    .where(ConversationParticipant.user_id == user_id)
                    .options(selectinload(Conversation.participants).selectinload(ConversationParticipant.user))
                    .order_by(Conversation.created_at.desc(), Conversation.id.desc())
                )
                result = await self.session.scalars(stmt)
                conversations = list(result.unique().all())
                if conversations:
                    return conversations[:limit]

        stmt = (
            select(Conversation)
            .join(ConversationParticipant, ConversationParticipant.conversation_id == Conversation.id)
            .where(ConversationParticipant.user_id == user_id)
            .options(
                selectinload(Conversation.participants).selectinload(ConversationParticipant.user),
            )
            .order_by(Conversation.created_at.desc(), Conversation.id.desc())
            .offset(offset)
            .limit(limit)
        )
        result = await self.session.scalars(stmt)
        conversations = list(result.unique().all())
        if offset == 0:
            await self.cache.cache_user_conversation_ids(user_id, [item.id for item in conversations])
        for conversation in conversations:
            await self._warm_cache_for_conversation(conversation)
        return conversations

    async def get_conversation_or_404(self, conversation_id: int, user_id: int) -> Conversation:
        stmt = (
            select(Conversation)
            .join(ConversationParticipant, ConversationParticipant.conversation_id == Conversation.id)
            .where(
                Conversation.id == conversation_id,
                ConversationParticipant.user_id == user_id,
            )
            .options(
                selectinload(Conversation.participants).selectinload(ConversationParticipant.user),
            )
        )
        conversation = await self.session.scalar(stmt)
        if conversation is None:
            raise HTTPException(status_code=status.HTTP_404_NOT_FOUND, detail="Conversation not found")
        await self._warm_cache_for_conversation(conversation)
        return conversation

    async def assert_member(self, conversation_id: int, user_id: int) -> None:
        cached_participants = await self.cache.get_participant_ids(conversation_id)
        if cached_participants is not None:
            if user_id in cached_participants:
                return
        stmt = select(ConversationParticipant.id).where(
            ConversationParticipant.conversation_id == conversation_id,
            ConversationParticipant.user_id == user_id,
        )
        participant_id = await self.session.scalar(stmt)
        if participant_id is None:
            raise HTTPException(status_code=status.HTTP_403_FORBIDDEN, detail="Not a conversation member")

    async def get_user_conversation_ids(self, user_id: int) -> list[int]:
        cached = await self.cache.get_user_conversation_ids(user_id, limit=5000)
        if cached is not None:
            return cached
        stmt = select(ConversationParticipant.conversation_id).where(ConversationParticipant.user_id == user_id)
        result = await self.session.scalars(stmt)
        ids = list(result.all())
        await self.cache.cache_user_conversation_ids(user_id, ids)
        return ids

    async def add_members(self, conversation_id: int, actor_id: int, user_ids: list[int]) -> Conversation:
        conversation = await self.get_conversation_or_404(conversation_id, actor_id)
        if conversation.type != ConversationType.group:
            raise HTTPException(
                status_code=status.HTTP_400_BAD_REQUEST,
                detail="Members can only be added to group conversations",
            )
        await self._assert_admin(conversation_id, actor_id)

        existing_stmt = select(ConversationParticipant.user_id).where(
            ConversationParticipant.conversation_id == conversation_id
        )
        existing_user_ids = set((await self.session.scalars(existing_stmt)).all())

        new_user_ids = set(user_ids) - existing_user_ids
        if not new_user_ids:
            return conversation

        await self._ensure_users_exist(new_user_ids)
        for user_id in new_user_ids:
            self.session.add(
                ConversationParticipant(
                    conversation_id=conversation_id,
                    user_id=user_id,
                    role=ParticipantRole.member,
                )
            )

        await self.session.commit()
        updated = await self.get_conversation_or_404(conversation_id, actor_id)
        await self.cache.invalidate_conversation(conversation_id)
        affected = set(existing_user_ids)
        affected.update(new_user_ids)
        for user_id in affected:
            await self.cache.invalidate_user_conversations(user_id)
        return updated

    async def remove_member(self, conversation_id: int, actor_id: int, user_id: int) -> Conversation:
        conversation = await self.get_conversation_or_404(conversation_id, actor_id)
        if conversation.type != ConversationType.group:
            raise HTTPException(
                status_code=status.HTTP_400_BAD_REQUEST,
                detail="Members can only be removed from group conversations",
            )
        await self._assert_admin(conversation_id, actor_id)
        if user_id == actor_id:
            raise HTTPException(
                status_code=status.HTTP_400_BAD_REQUEST,
                detail="Use a leave-group flow to remove yourself",
            )

        participant_stmt = select(ConversationParticipant).where(
            ConversationParticipant.conversation_id == conversation_id,
            ConversationParticipant.user_id == user_id,
        )
        participant = await self.session.scalar(participant_stmt)
        if participant is None:
            raise HTTPException(status_code=status.HTTP_404_NOT_FOUND, detail="Member not found")

        removed_role = participant.role
        await self.session.delete(participant)
        await self.session.flush()

        if removed_role == ParticipantRole.admin:
            admin_count_stmt = select(func.count(ConversationParticipant.id)).where(
                ConversationParticipant.conversation_id == conversation_id,
                ConversationParticipant.role == ParticipantRole.admin,
            )
            admin_count = await self.session.scalar(admin_count_stmt)
            if admin_count == 0:
                next_member_stmt = (
                    select(ConversationParticipant)
                    .where(ConversationParticipant.conversation_id == conversation_id)
                    .order_by(ConversationParticipant.joined_at.asc(), ConversationParticipant.id.asc())
                    .limit(1)
                )
                next_member = await self.session.scalar(next_member_stmt)
                if next_member is not None:
                    next_member.role = ParticipantRole.admin

        await self.session.commit()
        updated = await self.get_conversation_or_404(conversation_id, actor_id)
        await self.cache.invalidate_conversation(conversation_id)
        await self.cache.invalidate_user_conversations(actor_id)
        await self.cache.invalidate_user_conversations(user_id)
        return updated

    async def _assert_admin(self, conversation_id: int, user_id: int) -> None:
        stmt = select(ConversationParticipant.role).where(
            ConversationParticipant.conversation_id == conversation_id,
            ConversationParticipant.user_id == user_id,
        )
        role = await self.session.scalar(stmt)
        if role != ParticipantRole.admin:
            raise HTTPException(status_code=status.HTTP_403_FORBIDDEN, detail="Admin role required")

    async def _ensure_users_exist(self, user_ids: set[int]) -> None:
        if not user_ids:
            return
        stmt = select(func.count(User.id)).where(User.id.in_(user_ids))
        count = await self.session.scalar(stmt)
        if count != len(user_ids):
            raise HTTPException(
                status_code=status.HTTP_404_NOT_FOUND,
                detail="One or more users do not exist",
            )

    async def _find_existing_direct_conversation(self, participant_ids: set[int]) -> Conversation | None:
        direct_stmt = (
            select(Conversation.id)
            .join(ConversationParticipant, ConversationParticipant.conversation_id == Conversation.id)
            .where(
                Conversation.type == ConversationType.direct,
                ConversationParticipant.user_id.in_(participant_ids),
            )
            .group_by(Conversation.id)
            .having(func.count(distinct(ConversationParticipant.user_id)) == len(participant_ids))
        )
        conversation_id = await self.session.scalar(direct_stmt)
        if conversation_id is None:
            return None
        return await self.get_conversation_or_404(conversation_id, next(iter(participant_ids)))

    async def _warm_cache_for_conversation(self, conversation: Conversation) -> None:
        participant_ids = [participant.user_id for participant in conversation.participants]
        payload = {
            "id": conversation.id,
            "type": conversation.type.value,
            "title": conversation.title,
            "created_at": conversation.created_at.isoformat(),
        }
        await self.cache.cache_conversation_meta(conversation.id, payload, participant_ids)

    async def _publish_analytics_event(self, event: AnalyticsEvent) -> None:
        try:
            await self.analytics.publish(event)
        except Exception:
            return
