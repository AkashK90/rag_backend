import json
import redis.asyncio as aioredis
from loguru import logger
from langchain_core.messages import HumanMessage, AIMessage, BaseMessage
from app.core.config import get_settings
from app.services.cache_service import get_redis

settings = get_settings()

SESSION_PREFIX = "session:"


async def get_session_history(session_id: str) -> list[BaseMessage]:
    """Load chat history for a session from Redis."""
    try:
        r = await get_redis()
        key = f"{SESSION_PREFIX}{session_id}"
        raw = await r.get(key)
        if not raw:
            return []
        messages_data = json.loads(raw)
        messages = []
        for msg in messages_data:
            if msg["role"] == "human":
                messages.append(HumanMessage(content=msg["content"]))
            else:
                messages.append(AIMessage(content=msg["content"]))
        return messages
    except Exception as e:
        logger.warning(f"Memory GET failed for session {session_id}: {e}")
        return []


async def save_session_history(session_id: str, messages: list[BaseMessage]) -> None:
    """Persist updated chat history to Redis."""
    try:
        r = await get_redis()
        key = f"{SESSION_PREFIX}{session_id}"
        messages_data = []
        for msg in messages:
            role = "human" if isinstance(msg, HumanMessage) else "ai"
            messages_data.append({"role": role, "content": msg.content})
        await r.setex(key, settings.session_ttl_seconds, json.dumps(messages_data))
    except Exception as e:
        logger.warning(f"Memory SAVE failed for session {session_id}: {e}")


async def get_session_as_dict(session_id: str) -> list[dict]:
    """Return session messages as plain dicts (for API response)."""
    messages = await get_session_history(session_id)
    return [
        {
            "role": "human" if isinstance(m, HumanMessage) else "ai",
            "content": m.content,
        }
        for m in messages
    ]


async def list_all_sessions() -> list[str]:
    """Return all active session IDs."""
    try:
        r = await get_redis()
        keys = await r.keys(f"{SESSION_PREFIX}*")
        return [k.replace(SESSION_PREFIX, "") for k in keys]
    except Exception as e:
        logger.warning(f"Session LIST failed: {e}")
        return []


async def delete_session(session_id: str) -> bool:
    """Delete a session from Redis."""
    try:
        r = await get_redis()
        key = f"{SESSION_PREFIX}{session_id}"
        result = await r.delete(key)
        return result > 0
    except Exception as e:
        logger.warning(f"Session DELETE failed: {e}")
        return False
