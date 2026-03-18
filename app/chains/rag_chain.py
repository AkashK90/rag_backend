import time
from loguru import logger
from langchain_core.messages import HumanMessage, AIMessage

from app.services.cache_service import get_cached_answer, set_cached_answer
from app.services.memory_service import get_session_history, save_session_history
from app.services.retrieval_service import retrieve_relevant_chunks
from app.services.generation_service import generate_answer
from app.utils.logger import log_conversation


async def run_rag_chain(question: str, session_id: str) -> dict:
    """
    Full RAG pipeline:
    1. Check cache
    2. Load session memory
    3. Retrieve relevant chunks from Pinecone
    4. Generate answer with GPT-4
    5. Update memory + cache + log

    Returns dict with answer, sources, response_time_ms, cache_hit
    """
    start_time = time.time()

    # ── Step 1: Cache check ───────────────────────────
    cached = await get_cached_answer(question)
    if cached:
        elapsed = int((time.time() - start_time) * 1000)
        log_conversation(
            session_id=session_id,
            question=question,
            answer=cached["answer"],
            sources=cached["sources"],
            response_time_ms=elapsed,
            cache_hit=True,
        )
        return {**cached, "cache_hit": True, "response_time_ms": elapsed}

    # ── Step 2: Load session memory ───────────────────
    history = await get_session_history(session_id)
    logger.info(f"Session {session_id}: {len(history)} previous messages loaded")

    # ── Step 3: Retrieve relevant chunks ──────────────
    context_texts, sources = await retrieve_relevant_chunks(question)

    # ── Step 4: Generate answer ───────────────────────
    answer = await generate_answer(question, context_texts, history)

    # ── Step 5: Update memory ─────────────────────────
    updated_history = history + [
        HumanMessage(content=question),
        AIMessage(content=answer),
    ]
    await save_session_history(session_id, updated_history)

    # ── Step 6: Cache the result ──────────────────────
    result = {"answer": answer, "sources": sources}
    await set_cached_answer(question, result)

    # ── Step 7: Log conversation ──────────────────────
    elapsed = int((time.time() - start_time) * 1000)
    log_conversation(
        session_id=session_id,
        question=question,
        answer=answer,
        sources=sources,
        response_time_ms=elapsed,
        cache_hit=False,
    )
    logger.info(f"RAG chain completed in {elapsed}ms for session {session_id}")

    return {
        "answer": answer,
        "sources": sources,
        "cache_hit": False,
        "response_time_ms": elapsed,
    }
