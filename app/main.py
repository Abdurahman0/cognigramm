from contextlib import asynccontextmanager
from pathlib import Path

from fastapi import FastAPI, Query, WebSocket
from fastapi.middleware.cors import CORSMiddleware
from fastapi.staticfiles import StaticFiles

import app.database.models
from app.auth.router import router as auth_router
from app.config import get_settings
from app.conversations.router import router as conversations_router
from app.database.session import async_session_maker
from app.messages.router import close_message_router_resources, router as messages_router
from app.presence.router import get_presence_router
from app.redis.pubsub import RedisPubSub
from app.users.router import router as users_router
from app.websocket.gateway import ChatGateway
from app.websocket.manager import ConnectionManager


settings = get_settings()
connection_manager = ConnectionManager()
redis_pubsub = RedisPubSub(settings.redis_url)
chat_gateway = ChatGateway(connection_manager, redis_pubsub, async_session_maker, settings)


@asynccontextmanager
async def lifespan(_: FastAPI):
    await redis_pubsub.start(chat_gateway.handle_pubsub_message)
    yield
    await close_message_router_resources()
    await redis_pubsub.stop()
    await chat_gateway.analytics.close()


app = FastAPI(title=settings.app_name, debug=settings.debug, lifespan=lifespan)

app.add_middleware(
    CORSMiddleware,
    allow_origins=settings.cors_origins,
    allow_credentials=True,
    allow_methods=["*"],
    allow_headers=["*"],
)

app.include_router(auth_router)
app.include_router(users_router)
app.include_router(conversations_router)
app.include_router(messages_router)
app.include_router(get_presence_router(redis_pubsub))

media_root = Path(settings.local_media_dir)
media_root.mkdir(parents=True, exist_ok=True)
app.mount("/media", StaticFiles(directory=str(media_root)), name="media")


@app.get("/health")
async def health() -> dict[str, str]:
    return {"status": "ok"}


@app.websocket("/ws/chat")
async def chat_socket(
    websocket: WebSocket,
    token: str = Query(...),
    session_id: str | None = Query(default=None),
    device_id: str | None = Query(default=None),
) -> None:
    await chat_gateway.handle_connection(websocket, token, session_id=session_id, device_id=device_id)
