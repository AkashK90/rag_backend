import pytest
import os
from httpx import AsyncClient, ASGITransport
from main import app

ADMIN_KEY = os.getenv("ADMIN_API_KEY", "test-key")
HEADERS = {"X-Admin-API-Key": ADMIN_KEY}

@pytest.mark.asyncio
async def test_upload_no_auth():
    """Upload without admin key should return 403."""
    async with AsyncClient(transport=ASGITransport(app=app), base_url="http://test") as client:
        response = await client.post("/admin/upload")
    assert response.status_code == 403

@pytest.mark.asyncio
async def test_upload_invalid_file_type():
    """Uploading a .csv should return 400."""
    async with AsyncClient(transport=ASGITransport(app=app), base_url="http://test") as client:
        response = await client.post(
            "/admin/upload",
            headers=HEADERS,
            files={"file": ("data.csv", b"col1,col2\n1,2", "text/csv")},
        )
    assert response.status_code == 400

@pytest.mark.asyncio
async def test_upload_txt_file():
    """Upload a valid TXT file — requires live API keys."""
    if not os.getenv("OPENAI_API_KEY"):
        pytest.skip("Skipping live test — OPENAI_API_KEY not set")

    content = b"This is a test document. It contains information about our refund policy."
    async with AsyncClient(transport=ASGITransport(app=app), base_url="http://test") as client:
        response = await client.post(
            "/admin/upload",
            headers=HEADERS,
            files={"file": ("test_doc.txt", content, "text/plain")},
        )
    assert response.status_code == 200
    data = response.json()
    assert "chunks_ingested" in data
    assert data["chunks_ingested"] > 0
