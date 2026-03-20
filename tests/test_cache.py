import pytest
from app.utils.helpers import make_cache_key


def test_cache_key_deterministic():
    """Same question always produces same key."""
    q = "What is the refund policy?"
    assert make_cache_key(q) == make_cache_key(q)


def test_cache_key_normalized():
    """Different spacing/casing → same key."""
    a = make_cache_key("What is the refund policy?")
    b = make_cache_key("  what is the refund policy?  ")
    assert a == b

def test_cache_key_different_questions():
    """Different questions → different keys."""
    a = make_cache_key("What is the refund policy?")
    b = make_cache_key("What is the shipping time?")
    assert a != b

@pytest.mark.asyncio
async def test_cache_set_and_get():
    """Set a value in cache and retrieve it."""
    import os
    if not os.getenv("MONGODB_URI"):
        pytest.skip("Skipping — MONGODB_URI not set")

    from app.services.cache_service import set_cached_answer, get_cached_answer

    question = "pytest cache test question unique 12345"
    data = {"answer": "Test answer", "sources": ["test.pdf"]}

    await set_cached_answer(question, data)
    result = await get_cached_answer(question)

    assert result is not None
    assert result["answer"] == "Test answer"
