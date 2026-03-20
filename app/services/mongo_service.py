from datetime import datetime, timedelta
from motor.motor_asyncio import AsyncIOMotorClient, AsyncIOMotorDatabase
from loguru import logger

from app.core.config import get_settings

settings = get_settings()

_client: AsyncIOMotorClient | None = None
_indexes_ready: bool = False


async def _ensure_indexes(db: AsyncIOMotorDatabase) -> None:
    global _indexes_ready
    if _indexes_ready:
        return

    # Cache collection: key lookup + TTL cleanup
    cache = db["cache"]
    await cache.create_index("key", unique=True)
    await cache.create_index("expire_at", expireAfterSeconds=0)

    # Sessions collection: session_id lookup + TTL cleanup
    sessions = db["sessions"]
    await sessions.create_index("session_id", unique=True)
    await sessions.create_index("expire_at", expireAfterSeconds=0)

    # Conversations: query by time and session
    conversations = db["conversations"]
    await conversations.create_index("timestamp")
    await conversations.create_index("session_id")

    _indexes_ready = True
    logger.info("MongoDB indexes ensured for cache and sessions")


async def get_db() -> AsyncIOMotorDatabase:
    global _client
    if _client is None:
        _client = AsyncIOMotorClient(
            settings.mongodb_uri,
            serverSelectionTimeoutMS=5000,
        )
    db = _client[settings.mongodb_db]
    await _ensure_indexes(db)
    return db


def compute_expire_at(ttl_seconds: int) -> datetime:
    return datetime.utcnow() + timedelta(seconds=ttl_seconds)
