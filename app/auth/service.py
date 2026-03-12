from fastapi import HTTPException, status
from sqlalchemy import or_, select
from sqlalchemy.ext.asyncio import AsyncSession

from app.auth.schemas import LoginRequest, TokenResponse, RegisterRequest
from app.core.security import create_access_token, hash_password, verify_password
from app.users.models import User


class AuthService:
    def __init__(self, session: AsyncSession) -> None:
        self.session = session

    async def register(self, payload: RegisterRequest) -> User:
        exists_stmt = select(User).where(
            or_(User.username == payload.username, User.email == str(payload.email))
        )
        exists = await self.session.scalar(exists_stmt)
        if exists is not None:
            raise HTTPException(
                status_code=status.HTTP_409_CONFLICT,
                detail="Username or email already exists",
            )

        user = User(
            username=payload.username,
            email=str(payload.email),
            password_hash=hash_password(payload.password),
        )
        self.session.add(user)
        await self.session.commit()
        await self.session.refresh(user)
        return user

    async def login(self, payload: LoginRequest) -> TokenResponse:
        stmt = select(User).where(
            or_(User.username == payload.identifier, User.email == payload.identifier)
        )
        user = await self.session.scalar(stmt)
        if user is None or not verify_password(payload.password, user.password_hash):
            raise HTTPException(
                status_code=status.HTTP_401_UNAUTHORIZED,
                detail="Invalid credentials",
            )

        token = create_access_token(subject=user.id)
        return TokenResponse(access_token=token)
