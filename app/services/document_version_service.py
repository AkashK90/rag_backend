"""
Document Version Service
------------------------
Tracks every ingested document version in a JSON registry stored at
data/document_registry.json  (persisted on disk, survives restarts).

Each document entry:
{
  "policy.pdf": {
    "current_version_id": "v3",
    "versions": {
      "v1": { "version_id": "v1", "filename": "policy.pdf", "uploaded_at": "...",
               "chunks": 42, "size_bytes": 102400, "is_current": false,
               "vector_ids": ["id1", "id2", ...] },
      "v2": { ... },
      "v3": { ..., "is_current": true }
    }
  }
}
"""

import json
import uuid
from datetime import datetime, timezone
from pathlib import Path
from loguru import logger
import asyncio

REGISTRY_PATH = Path("data/document_registry.json")
REGISTRY_PATH.parent.mkdir(exist_ok=True)

_lock = asyncio.Lock()


def _load_registry() -> dict:
    if not REGISTRY_PATH.exists():
        return {}
    try:
        return json.loads(REGISTRY_PATH.read_text(encoding="utf-8"))
    except Exception:
        return {}


def _save_registry(registry: dict) -> None:
    REGISTRY_PATH.write_text(json.dumps(registry, indent=2, ensure_ascii=False), encoding="utf-8")


async def register_version(filename: str, chunks: int, size_bytes: int, vector_ids: list[str]) -> str:
    """
    Register a new version of a document after successful ingestion.
    Returns the new version_id.
    """
    async with _lock:
        registry = _load_registry()
        version_id = f"v{uuid.uuid4().hex[:8]}"
        now = datetime.now(timezone.utc).isoformat()

        if filename not in registry:
            registry[filename] = {"current_version_id": version_id, "versions": {}}
        else:
            # Mark all existing versions as not current
            for v in registry[filename]["versions"].values():
                v["is_current"] = False
            registry[filename]["current_version_id"] = version_id

        registry[filename]["versions"][version_id] = {
            "version_id": version_id,
            "filename": filename,
            "uploaded_at": now,
            "chunks": chunks,
            "size_bytes": size_bytes,
            "is_current": True,
            "vector_ids": vector_ids,
        }

        _save_registry(registry)
        logger.info(f"Registered version {version_id} for {filename} ({chunks} chunks)")
        return version_id


async def list_documents() -> list[dict]:
    """Return summary list of all documents with their current version info."""
    registry = _load_registry()
    result = []
    for filename, doc in registry.items():
        current_vid = doc["current_version_id"]
        current = doc["versions"].get(current_vid, {})
        result.append({
            "filename": filename,
            "chunks": current.get("chunks", 0),
            "uploaded_at": current.get("uploaded_at", ""),
            "version_count": len(doc["versions"]),
            "current_version_id": current_vid,
        })
    return sorted(result, key=lambda x: x["uploaded_at"], reverse=True)


async def get_document_versions(filename: str) -> list[dict]:
    """Return all versions of a document, newest first."""
    registry = _load_registry()
    if filename not in registry:
        return []
    versions = list(registry[filename]["versions"].values())
    return sorted(versions, key=lambda x: x["uploaded_at"], reverse=True)


async def get_version_vector_ids(filename: str, version_id: str) -> list[str]:
    """Get the Pinecone vector IDs for a specific version."""
    registry = _load_registry()
    return registry.get(filename, {}).get("versions", {}).get(version_id, {}).get("vector_ids", [])


async def get_current_vector_ids(filename: str) -> list[str]:
    """Get Pinecone vector IDs for the current version of a document."""
    registry = _load_registry()
    doc = registry.get(filename, {})
    current_vid = doc.get("current_version_id")
    if not current_vid:
        return []
    return doc.get("versions", {}).get(current_vid, {}).get("vector_ids", [])


async def rollback_to_version(filename: str, version_id: str) -> dict:
    """
    Roll back a document to a previous version.
    Returns the version dict for the restored version.
    """
    async with _lock:
        registry = _load_registry()
        if filename not in registry:
            raise ValueError(f"Document not found: {filename}")
        if version_id not in registry[filename]["versions"]:
            raise ValueError(f"Version not found: {version_id}")

        # Mark all as not current, then set chosen version as current
        for v in registry[filename]["versions"].values():
            v["is_current"] = False
        registry[filename]["versions"][version_id]["is_current"] = True
        registry[filename]["current_version_id"] = version_id

        _save_registry(registry)
        logger.info(f"Rolled back {filename} to version {version_id}")
        return registry[filename]["versions"][version_id]


async def deregister_document(filename: str) -> None:
    """Remove a document entirely from the registry."""
    async with _lock:
        registry = _load_registry()
        if filename in registry:
            del registry[filename]
            _save_registry(registry)
            logger.info(f"Deregistered document: {filename}")
