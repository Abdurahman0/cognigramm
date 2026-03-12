import asyncio
from contextlib import asynccontextmanager

from fastapi import FastAPI, Query, WebSocket
from fastapi.middleware.cors import CORSMiddleware

import app.database.models
from app.config import get_settings
from app.database.session import async_session_maker
from app.redis.pubsub import RedisPubSub
from app.websocket.gateway import ChatGateway
from app.websocket.manager import ConnectionManager


settings = get_settings()
connection_manager = ConnectionManager()
redis_pubsub = RedisPubSub(settings.redis_url)
chat_gateway = ChatGateway(connection_manager, redis_pubsub, async_session_maker, settings)


@asynccontextmanager
async def lifespan(_: FastAPI):
    await redis_pubsub.start(chat_gateway.handle_pubsub_message)
    stop_event = asyncio.Event()
    maintenance_task = asyncio.create_task(chat_gateway.run_presence_maintenance(stop_event))
    yield
    stop_event.set()
    await maintenance_task
    await redis_pubsub.stop()
    await chat_gateway.analytics.close()


app = FastAPI(title=f"{settings.app_name} WebSocket", debug=settings.debug, lifespan=lifespan)

app.add_middleware(
    CORSMiddleware,
    allow_origins=settings.cors_origins,
    allow_credentials=True,
    allow_methods=["*"],
    allow_headers=["*"],
)


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
