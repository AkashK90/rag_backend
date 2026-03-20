from datetime import datetime
from loguru import logger
from app.core.config import get_settings
from app.utils.helpers import make_cache_key
from app.services.mongo_service import get_db, compute_expire_at

settings = get_settings()

# ─── Exact-match cache (MongoDB) ──────────────────────

async def get_cached_answer(question: str) -> dict | None:
    """Return cached answer dict or None on miss."""
    try:
        key = f"cache:exact:{make_cache_key(question)}"
        db = await get_db()
        doc = await db["cache"].find_one({"key": key})
        if not doc:
            return None
        expire_at = doc.get("expire_at")
        if expire_at and expire_at <= datetime.utcnow():
            await db["cache"].delete_one({"_id": doc["_id"]})
            return None
        logger.info(f"Cache HIT for question: {question[:60]}...")
        return doc.get("answer_data")
    except Exception as e:
        logger.warning(f"Cache GET failed: {e}")
    return None


async def set_cached_answer(question: str, answer_data: dict) -> None:
    """Store answer in MongoDB with TTL."""
    try:
        key = f"cache:exact:{make_cache_key(question)}"
        db = await get_db()
        await db["cache"].update_one(
            {"key": key},
            {
                "$set": {
                    "key": key,
                    "question": question,
                    "answer_data": answer_data,
                    "expire_at": compute_expire_at(settings.cache_ttl_seconds),
                }
            },
            upsert=True,
        )
        logger.info(f"Cache SET for question: {question[:60]}...")
    except Exception as e:
        logger.warning(f"Cache SET failed: {e}")


async def clear_all_cache() -> int:
    """Delete all cache keys. Returns count deleted."""
    try:
        db = await get_db()
        result = await db["cache"].delete_many({})
        logger.info(f"Cache cleared: {result.deleted_count} keys deleted")
        return int(result.deleted_count)
    except Exception as e:
        logger.warning(f"Cache CLEAR failed: {e}")
        return 0


async def get_cache_stats() -> dict:
    """Return cache statistics."""
    try:
        db = await get_db()
        now = datetime.utcnow()
        count = await db["cache"].count_documents({"expire_at": {"$gt": now}})
        return {"total_cached_keys": int(count), "ttl_seconds": settings.cache_ttl_seconds}
    except Exception as e:
        logger.warning(f"Cache STATS failed: {e}")
        return {"total_cached_keys": 0, "ttl_seconds": settings.cache_ttl_seconds}
