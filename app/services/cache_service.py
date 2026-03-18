import json
import numpy as np
import redis.asyncio as aioredis
from loguru import logger
from app.core.config import get_settings
from app.utils.helpers import make_cache_key

settings = get_settings()

# ─── Redis client (shared) ────────────────────────────
_redis: aioredis.Redis | None = None


async def get_redis() -> aioredis.Redis:
    global _redis
    if _redis is None:
        _redis = aioredis.from_url(
            settings.redis_url,
            encoding="utf-8",
            decode_responses=True,
            socket_connect_timeout=5,
        )
    return _redis

# ─── Exact-match cache ────────────────────────────────

async def get_cached_answer(question: str) -> dict | None:
    """Return cached answer dict or None on miss."""
    try:
        r = await get_redis()
        key = f"cache:exact:{make_cache_key(question)}"
        value = await r.get(key)
        if value:
            logger.info(f"Cache HIT for question: {question[:60]}...")
            return json.loads(value)
    except Exception as e:
        logger.warning(f"Cache GET failed: {e}")
    return None


async def set_cached_answer(question: str, answer_data: dict) -> None:
    """Store answer in Redis with TTL."""
    try:
        r = await get_redis()
        key = f"cache:exact:{make_cache_key(question)}"
        await r.setex(key, settings.cache_ttl_seconds, json.dumps(answer_data))
        logger.info(f"Cache SET for question: {question[:60]}...")
    except Exception as e:
        logger.warning(f"Cache SET failed: {e}")


async def clear_all_cache() -> int:
    """Delete all cache keys. Returns count deleted."""
    try:
        r = await get_redis()
        keys = await r.keys("cache:exact:*")
        if keys:
            await r.delete(*keys)
        logger.info(f"Cache cleared: {len(keys)} keys deleted")
        return len(keys)
    except Exception as e:
        logger.warning(f"Cache CLEAR failed: {e}")
        return 0


async def get_cache_stats() -> dict:
    """Return cache statistics."""
    try:
        r = await get_redis()
        keys = await r.keys("cache:exact:*")
        return {"total_cached_keys": len(keys), "ttl_seconds": settings.cache_ttl_seconds}
    except Exception as e:
        logger.warning(f"Cache STATS failed: {e}")
        return {"total_cached_keys": 0, "ttl_seconds": settings.cache_ttl_seconds}
