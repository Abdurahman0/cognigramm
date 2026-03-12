from fastapi import APIRouter, Depends, Query
from sqlalchemy import or_, select
from sqlalchemy.ext.asyncio import AsyncSession

from app.core.dependencies import get_current_user
from app.database.session import get_db_session
from app.users.models import User
from app.users.schemas import UserOut


router = APIRouter(prefix="/users", tags=["users"])


@router.get("/me", response_model=UserOut)
async def get_me(current_user: User = Depends(get_current_user)) -> User:
    return current_user


@router.get("", response_model=list[UserOut])
async def list_users(
    q: str | None = Query(default=None, min_length=1, max_length=100),
    limit: int = Query(default=20, ge=1, le=100),
    offset: int = Query(default=0, ge=0),
    include_self: bool = Query(default=False),
    current_user: User = Depends(get_current_user),
    session: AsyncSession = Depends(get_db_session),
) -> list[User]:
    stmt = select(User)
    if not include_self:
        stmt = stmt.where(User.id != current_user.id)
    if q:
        like_value = f"%{q.strip()}%"
        stmt = stmt.where(or_(User.username.ilike(like_value), User.email.ilike(like_value)))
    stmt = stmt.order_by(User.username.asc(), User.id.asc()).offset(offset).limit(limit)
    result = await session.scalars(stmt)
    return list(result.all())
