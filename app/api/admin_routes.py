import os
from pathlib import Path
from fastapi import APIRouter, UploadFile, File, Depends, HTTPException
from loguru import logger

from app.core.config import get_settings
from app.core.security import verify_admin_key
from app.models.request_models import ClearCacheRequest
from app.models.response_models import (
    UploadResponse, HealthResponse, SessionResponse,
    SessionMessage, CacheStatsResponse, DeleteDocumentResponse,
)
from app.services.ingestion_service import ingest_document, delete_document_by_filename
from app.services.memory_service import get_session_as_dict, list_all_sessions, delete_session
from app.services.cache_service import clear_all_cache, get_cache_stats
from app.services.mongo_service import get_db
from app.core.dependencies import get_pinecone_index, get_embeddings

settings = get_settings()
router = APIRouter(prefix="/admin", tags=["Admin"], dependencies=[Depends(verify_admin_key)])

UPLOAD_DIR = Path("uploads")
UPLOAD_DIR.mkdir(exist_ok=True)
MAX_BYTES = settings.max_upload_size_mb * 1024 * 1024


# ── Document Upload ───────────────────────────────────
@router.post("/upload", response_model=UploadResponse)
async def upload_document(file: UploadFile = File(...)):
    """
    🛠️ Upload a PDF or TXT file to ingest into the knowledge base.
    Protected by HTTP Basic Auth.
    """
    allowed_types = {"application/pdf", "text/plain"}
    if file.content_type not in allowed_types:
        raise HTTPException(status_code=400, detail="Only PDF and TXT files are supported.")

    content = await file.read()
    if len(content) > MAX_BYTES:
        raise HTTPException(status_code=413, detail=f"File too large. Max size: {settings.max_upload_size_mb}MB")

    # Save temporarily
    temp_path = UPLOAD_DIR / file.filename
    with open(temp_path, "wb") as f:
        f.write(content)

    try:
        chunks = await ingest_document(str(temp_path), file.filename)
        return UploadResponse(
            filename=file.filename,
            chunks_ingested=chunks,
            message=f"Successfully ingested {chunks} chunks from {file.filename}",
        )
    except Exception as e:
        logger.error(f"Ingestion failed for {file.filename}: {e}")
        raise HTTPException(status_code=500, detail=f"Ingestion failed: {str(e)}")
    finally:
        if temp_path.exists():
            os.remove(temp_path)


# ── Delete Document ───────────────────────────────────
@router.delete("/document/{filename}", response_model=DeleteDocumentResponse)
async def delete_document(filename: str):
    """
    🛠️ Remove all vectors for a specific document from Pinecone.
    """
    try:
        count = await delete_document_by_filename(filename)
        if count == 0:
            raise HTTPException(status_code=404, detail=f"No vectors found for: {filename}")
        return DeleteDocumentResponse(
            message=f"Deleted all vectors for {filename}",
            vectors_deleted=count,
        )
    except HTTPException:
        raise
    except Exception as e:
        logger.error(f"Delete document error: {e}")
        raise HTTPException(status_code=500, detail=str(e))


# ── Session Monitoring ────────────────────────────────
@router.get("/sessions", response_model=list[str])
async def get_all_sessions():
    """🛠️ List all active session IDs."""
    return await list_all_sessions()


@router.get("/sessions/{session_id}", response_model=SessionResponse)
async def get_session(session_id: str):
    """🛠️ Get full conversation history for a session."""
    messages = await get_session_as_dict(session_id)
    if not messages:
        raise HTTPException(status_code=404, detail=f"Session not found: {session_id}")
    return SessionResponse(
        session_id=session_id,
        messages=[SessionMessage(**m) for m in messages],
        total_messages=len(messages),
    )


@router.delete("/sessions/{session_id}")
async def remove_session(session_id: str):
    """🛠️ Delete a specific session from MongoDB."""
    deleted = await delete_session(session_id)
    if not deleted:
        raise HTTPException(status_code=404, detail=f"Session not found: {session_id}")
    return {"message": f"Session {session_id} deleted."}


# ── Conversation Logs ─────────────────────────────────
@router.get("/logs/conversations")
async def get_conversation_logs(limit: int = 100):
    """
    🛠️ Return last N conversation records from MongoDB
    """
    db = await get_db()
    total = await db["conversations"].count_documents({})
    cursor = (
        db["conversations"]
        .find({})
        .sort("timestamp", -1)
        .limit(limit)
    )
    conversations = []
    async for doc in cursor:
        doc.pop("_id", None)
        ts = doc.get("timestamp")
        if ts:
            doc["timestamp"] = ts.isoformat()
        conversations.append(doc)
    return {"conversations": conversations, "total": int(total)}


@router.get("/logs/app")
async def get_app_logs(lines: int = 100):
    """🛠️ Return last N lines of app.log"""
    log_path = Path("logs/app.log")
    if not log_path.exists():
        return {"logs": [], "total_lines": 0}

    all_lines = log_path.read_text(encoding="utf-8").strip().splitlines()
    recent = all_lines[-lines:]
    recent.reverse()
    return {"logs": recent, "total_lines": len(all_lines)}


# ── Cache Management ──────────────────────────────────
@router.get("/cache/stats", response_model=CacheStatsResponse)
async def cache_stats():
    """🛠️ View cache statistics."""
    stats = await get_cache_stats()
    return CacheStatsResponse(**stats)


@router.delete("/cache/clear")
async def clear_cache(body: ClearCacheRequest):
    """🛠️ Clear all cached responses."""
    if not body.confirm:
        raise HTTPException(status_code=400, detail="Set confirm=true to clear cache.")
    count = await clear_all_cache()
    return {"message": f"Cache cleared. {count} keys deleted."}


# ── Health Check ──────────────────────────────────────
@router.get("/health", response_model=HealthResponse)
async def health_check():
    """🛠️ Check connectivity to Pinecone, MongoDB, and OpenAI."""
    # Check MongoDB
    mongodb_status = "ok"
    try:
        db = await get_db()
        await db.command("ping")
    except Exception as e:
        mongodb_status = f"error: {e}"

    # Check Pinecone
    pinecone_status = "ok"
    try:
        idx = get_pinecone_index()
        idx.describe_index_stats()
    except Exception as e:
        pinecone_status = f"error: {e}"

    # Check OpenAI (lightweight)
    openai_status = "ok"
    try:
        emb = get_embeddings()
        await emb.aembed_query("health check")
    except Exception as e:
        openai_status = f"error: {e}"

    overall = "healthy" if all(
        s == "ok" for s in [mongodb_status, pinecone_status, openai_status]
    ) else "degraded"

    return HealthResponse(
        status=overall,
        pinecone=pinecone_status,
        mongodb=mongodb_status,
        openai=openai_status,
    )


# ── Document Inventory & Versioning ──────────────────
from app.services.document_version_service import list_documents, get_document_versions
from app.services.ingestion_service import rollback_document
from app.models.response_models import DocumentRecord, DocumentVersion, RollbackResponse


@router.get("/documents", response_model=list[DocumentRecord])
async def list_all_documents():
    """🛠️ List all ingested documents with version metadata."""
    docs = await list_documents()
    return [DocumentRecord(**d) for d in docs]


@router.get("/documents/{filename}/versions", response_model=list[DocumentVersion])
async def get_versions(filename: str):
    """🛠️ List all versions of a specific document."""
    versions = await get_document_versions(filename)
    if not versions:
        raise HTTPException(status_code=404, detail=f"No versions found for: {filename}")
    return [DocumentVersion(**v) for v in versions]


@router.post("/documents/{filename}/rollback/{version_id}", response_model=RollbackResponse)
async def rollback_document_version(filename: str, version_id: str):
    """🛠️ Roll back a document to a specific previous version."""
    try:
        chunks = await rollback_document(filename, version_id)
        return RollbackResponse(
            message=f"Successfully rolled back {filename} to version {version_id}",
            filename=filename,
            rolled_back_to=version_id,
            chunks_restored=chunks,
        )
    except ValueError as e:
        raise HTTPException(status_code=404, detail=str(e))
    except Exception as e:
        logger.error(f"Rollback error: {e}")
        raise HTTPException(status_code=500, detail=str(e))
