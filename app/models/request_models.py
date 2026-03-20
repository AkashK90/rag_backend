# ─── Request Models ───────────────────────────────────
from pydantic import BaseModel, Field
from typing import Optional

class ChatRequest(BaseModel):
    question: str = Field(..., min_length=1, max_length=2000, description="User's question")
    session_id: Optional[str] = Field(
        None, min_length=1, max_length=100, description="Unique session ID per user"
    )

class ClearCacheRequest(BaseModel):
    confirm: bool = Field(..., description="Must be true to confirm cache clear")

