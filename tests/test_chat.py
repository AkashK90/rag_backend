import pytest
from httpx import AsyncClient, ASGITransport
from main import app


@pytest.mark.asyncio
async def test_chat_missing_question():
    async with AsyncClient(transport=ASGITransport(app=app), base_url="http://test") as client:
        response = await client.post("/api/chat", json={"session_id": "test-session"})
    assert response.status_code == 422  # Validation error — question missing


@pytest.mark.asyncio
async def test_chat_missing_session():
    async with AsyncClient(transport=ASGITransport(app=app), base_url="http://test") as client:
        response = await client.post("/api/chat", json={"question": "What is this?"})
    assert response.status_code == 422  # Validation error — session_id missing

@pytest.mark.asyncio
async def test_chat_response_shape():
    """
    This test hits the real pipeline — only run with valid API keys.
    Skip in CI unless keys are set.
    """
    import os
    if not os.getenv("OPENAI_API_KEY"):
        pytest.skip("Skipping live test — OPENAI_API_KEY not set")

    async with AsyncClient(transport=ASGITransport(app=app), base_url="http://test") as client:
        response = await client.post("/api/chat", json={
            "question": "Hello, what can you help me with?",
            "session_id": "pytest-session-001",
        })
    assert response.status_code == 200
    data = response.json()
    assert "answer" in data
    assert "sources" in data
    assert "session_id" in data
    assert "response_time_ms" in data
    assert "cache_hit" in data
