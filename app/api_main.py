from contextlib import asynccontextmanager
from pathlib import Path

from fastapi import FastAPI
from fastapi.middleware.cors import CORSMiddleware
from fastapi.staticfiles import StaticFiles

import app.database.models
from app.auth.router import router as auth_router
from app.config import get_settings
from app.conversations.router import router as conversations_router
from app.messages.router import close_message_router_resources, router as messages_router
from app.presence.router import get_presence_router
from app.redis.pubsub import RedisPubSub
from app.users.router import router as users_router


settings = get_settings()
presence_pubsub = RedisPubSub(settings.redis_url)


@asynccontextmanager
async def lifespan(_: FastAPI):
    yield
    await close_message_router_resources()
    await presence_pubsub.redis.aclose()


app = FastAPI(title=f"{settings.app_name} API", debug=settings.debug, lifespan=lifespan)

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
app.include_router(get_presence_router(presence_pubsub))

media_root = Path(settings.local_media_dir)
media_root.mkdir(parents=True, exist_ok=True)
app.mount("/media", StaticFiles(directory=str(media_root)), name="media")


@app.get("/health")
async def health() -> dict[str, str]:
    return {"status": "ok"}
