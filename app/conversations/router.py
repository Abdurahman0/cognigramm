from fastapi import APIRouter, Depends, Query
from sqlalchemy.ext.asyncio import AsyncSession

from app.conversations.schemas import AddMembersRequest, ConversationCreateRequest, ConversationMemberOut, ConversationOut
from app.conversations.service import ConversationService
from app.core.dependencies import get_current_user
from app.database.session import get_db_session
from app.users.models import User


router = APIRouter(prefix="/conversations", tags=["conversations"])


def build_conversation_out(conversation) -> ConversationOut:
    participants = [
        ConversationMemberOut(
            user_id=member.user_id,
            username=member.user.username,
            role=member.role,
            joined_at=member.joined_at,
        )
        for member in conversation.participants
    ]
    participants.sort(key=lambda item: item.user_id)
    return ConversationOut(
        id=conversation.id,
        type=conversation.type,
        title=conversation.title,
        created_at=conversation.created_at,
        participants=participants,
    )


@router.post("", response_model=ConversationOut)
async def create_conversation(
    payload: ConversationCreateRequest,
    current_user: User = Depends(get_current_user),
    session: AsyncSession = Depends(get_db_session),
) -> ConversationOut:
    service = ConversationService(session)
    conversation = await service.create_conversation(current_user.id, payload)
    return build_conversation_out(conversation)


@router.get("", response_model=list[ConversationOut])
async def list_conversations(
    limit: int = Query(default=50, ge=1, le=100),
    offset: int = Query(default=0, ge=0),
    current_user: User = Depends(get_current_user),
    session: AsyncSession = Depends(get_db_session),
) -> list[ConversationOut]:
    service = ConversationService(session)
    conversations = await service.list_conversations(current_user.id, limit, offset)
    return [build_conversation_out(conversation) for conversation in conversations]


@router.get("/{conversation_id}", response_model=ConversationOut)
async def get_conversation(
    conversation_id: int,
    current_user: User = Depends(get_current_user),
    session: AsyncSession = Depends(get_db_session),
) -> ConversationOut:
    service = ConversationService(session)
    conversation = await service.get_conversation_or_404(conversation_id, current_user.id)
    return build_conversation_out(conversation)


@router.post("/{conversation_id}/members", response_model=ConversationOut)
async def add_members(
    conversation_id: int,
    payload: AddMembersRequest,
    current_user: User = Depends(get_current_user),
    session: AsyncSession = Depends(get_db_session),
) -> ConversationOut:
    service = ConversationService(session)
    conversation = await service.add_members(conversation_id, current_user.id, payload.user_ids)
    return build_conversation_out(conversation)


@router.delete("/{conversation_id}/members/{user_id}", response_model=ConversationOut)
async def remove_member(
    conversation_id: int,
    user_id: int,
    current_user: User = Depends(get_current_user),
    session: AsyncSession = Depends(get_db_session),
) -> ConversationOut:
    service = ConversationService(session)
    conversation = await service.remove_member(conversation_id, current_user.id, user_id)
    return build_conversation_out(conversation)
