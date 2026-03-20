import sys
from pathlib import Path
from loguru import logger
from app.core.config import get_settings

settings = get_settings()

# ─── Ensure log directory exists ──────────────────────
Path("logs").mkdir(exist_ok=True)

# ─── Remove default handler ───────────────────────────
logger.remove()

# ─── Console handler ──────────────────────────────────
logger.add(
    sys.stdout,
    level=settings.log_level,
    format="<green>{time:YYYY-MM-DD HH:mm:ss}</green> | <level>{level}</level> | <cyan>{name}</cyan> | {message}",
    colorize=True,
)

# ─── App log file (system events, errors) ─────────────
logger.add(
    "logs/app.log",
    level=settings.log_level,
    format="{time:YYYY-MM-DD HH:mm:ss} | {level} | {name} | {message}",
    rotation="10 MB",
    retention="30 days",
    compression="zip",
    enqueue=True,  # async-safe
)


async def log_conversation(
    session_id: str,
    question: str,
    answer: str,
    sources: list[str],
    response_time_ms: int,
    cache_hit: bool,
):
    """Persist one Q&A record to MongoDB."""
    from datetime import datetime, timezone
    from app.services.mongo_service import get_db

    record = {
        "timestamp": datetime.now(timezone.utc),
        "session_id": session_id,
        "question": question,
        "answer": answer,
        "sources": sources,
        "response_time_ms": response_time_ms,
        "cache_hit": cache_hit,
    }
    try:
        db = await get_db()
        await db["conversations"].insert_one(record)
    except Exception as e:
        logger.warning(f"Conversation log failed: {e}")
