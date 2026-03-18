import uuid
from fastapi import APIRouter, HTTPException
from loguru import logger
from app.models.request_models import ChatRequest
from app.models.response_models import ChatResponse
from app.chains.rag_chain import run_rag_chain

router = APIRouter(prefix="/api", tags=["User"])


@router.post("/chat", response_model=ChatResponse)
async def chat(request: ChatRequest):
    """
    👤 PUBLIC ENDPOINT — called by your website chatbot.

    Send a question and session_id, get an answer back.
    - Automatically handles conversation memory per session_id
    - Returns answer, sources, response time, and cache status
    """
    try:
        session_id = request.session_id
        if not session_id or session_id.strip().lower() == "string":
            session_id = str(uuid.uuid4())
            logger.info(f"Chat request | session=generated:{session_id} | q={request.question[:60]}")
        else:
            logger.info(f"Chat request | session={session_id} | q={request.question[:60]}")
        result = await run_rag_chain(
            question=request.question,
            session_id=session_id,
        )
        return ChatResponse(
            answer=result["answer"],
            sources=result["sources"],
            session_id=session_id,
            response_time_ms=result["response_time_ms"],
            cache_hit=result["cache_hit"],
        )
    except Exception as e:
        logger.error(f"Chat error for session {request.session_id}: {e}")
        raise HTTPException(status_code=500, detail="Something went wrong. Please try again.")
