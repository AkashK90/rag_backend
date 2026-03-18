import hashlib
import re


def make_cache_key(text: str) -> str:
    """Deterministic cache key from a question string."""
    normalized = re.sub(r"\s+", " ", text.strip().lower())
    return hashlib.sha256(normalized.encode()).hexdigest()


def extract_source_label(metadata: dict) -> str:
    """Build a human-readable source label from chunk metadata."""
    filename = metadata.get("filename", "unknown")
    page = metadata.get("page", None)
    if page is not None:
        return f"{filename} — page {page}"
    return filename


def truncate_text(text: str, max_chars: int = 300) -> str:
    """Truncate text for log previews."""
    if len(text) <= max_chars:
        return text
    return text[:max_chars] + "..."
