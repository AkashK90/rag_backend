from datetime import datetime
from loguru import logger
from langchain_core.messages import HumanMessage, AIMessage, BaseMessage
from app.core.config import get_settings
from app.services.mongo_service import get_db, compute_expire_at

settings = get_settings()

async def get_session_history(session_id: str) -> list[BaseMessage]:
    """Load chat history for a session from MongoDB."""
    try:
        db = await get_db()
        doc = await db["sessions"].find_one({"session_id": session_id})
        if not doc:
            return []
        expire_at = doc.get("expire_at")
        if expire_at and expire_at <= datetime.utcnow():
            await db["sessions"].delete_one({"_id": doc["_id"]})
            return []
        messages_data = doc.get("messages", [])
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
    """Persist updated chat history to MongoDB."""
    try:
        messages_data = []
        for msg in messages:
            role = "human" if isinstance(msg, HumanMessage) else "ai"
            messages_data.append({"role": role, "content": msg.content})
        db = await get_db()
        await db["sessions"].update_one(
            {"session_id": session_id},
            {
                "$set": {
                    "session_id": session_id,
                    "messages": messages_data,
                    "expire_at": compute_expire_at(settings.session_ttl_seconds),
                }
            },
            upsert=True,
        )
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
        db = await get_db()
        now = datetime.utcnow()
        cursor = db["sessions"].find({"expire_at": {"$gt": now}}, {"session_id": 1})
        sessions = []
        async for doc in cursor:
            sessions.append(doc["session_id"])
        return sessions
    except Exception as e:
        logger.warning(f"Session LIST failed: {e}")
        return []


async def delete_session(session_id: str) -> bool:
    """Delete a session from MongoDB."""
    try:
        db = await get_db()
        result = await db["sessions"].delete_one({"session_id": session_id})
        return result.deleted_count > 0
    except Exception as e:
        logger.warning(f"Session DELETE failed: {e}")
        return False
