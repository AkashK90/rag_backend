from pydantic import BaseModel
from typing import Optional

class ChatResponse(BaseModel):
    answer: str
    sources: list[str]
    session_id: str
    response_time_ms: int
    cache_hit: bool

class UploadResponse(BaseModel):
    filename: str
    chunks_ingested: int
    message: str

class HealthResponse(BaseModel):
    status: str
    pinecone: str
    redis: str
    openai: str

class SessionMessage(BaseModel):
    role: str  # "human" or "ai"
    content: str

class SessionResponse(BaseModel):
    session_id: str
    messages: list[SessionMessage]
    total_messages: int

class CacheStatsResponse(BaseModel):
    total_cached_keys: int
    ttl_seconds: int

class DeleteDocumentResponse(BaseModel):
    message: str
    vectors_deleted: int

class DocumentVersion(BaseModel):
    version_id: str
    filename: str
    uploaded_at: str
    chunks: int
    size_bytes: int
    is_current: bool

class DocumentRecord(BaseModel):
    filename: str
    chunks: int
    uploaded_at: str
    version_count: int
    current_version_id: str

class RollbackResponse(BaseModel):
    message: str
    filename: str
    rolled_back_to: str
    chunks_restored: int
