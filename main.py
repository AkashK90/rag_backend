from contextlib import asynccontextmanager
from fastapi import FastAPI, Request
from fastapi.middleware.cors import CORSMiddleware
from fastapi.responses import JSONResponse
from loguru import logger
from slowapi import Limiter, _rate_limit_exceeded_handler
from slowapi.util import get_remote_address
from slowapi.errors import RateLimitExceeded
from slowapi.middleware import SlowAPIMiddleware

from app.api.user_routes import router as user_router
from app.api.admin_routes import router as admin_router
from app.core.config import get_settings
import app.utils.logger  # noqa: F401 — initializes loguru handlers (adds file sinks)

settings = get_settings()

# ── Rate limiter ───────────────────────────────────────
limiter = Limiter(key_func=get_remote_address, default_limits=["60/minute"])

# ── Lifespan (startup / shutdown) ─────────────────────
@asynccontextmanager
async def lifespan(app: FastAPI):
    logger.info("🚀 RAG Backend starting up...")
    logger.info(f"Environment: {settings.app_env}")
    yield
    logger.info("🛑 RAG Backend shutting down...")


# ── App init ──────────────────
app = FastAPI(
    title="RAG Chatbot API",
    description="""
                    ## RAG Chatbot Backend

                    ### 👤 User Endpoints (Public)
                    - `POST /api/chat` — Ask a question, get an answer with memory

                    ### 🛠️ Admin Endpoints (Protected — requires Basic Auth)
                    - `POST /admin/upload` — Upload PDF or TXT to knowledge base
                    - `DELETE /admin/document/{filename}` — Remove a document
                    - `GET /admin/sessions` — List all active sessions
                    - `GET /admin/sessions/{session_id}` — View a session's conversation
                    - `GET /admin/logs/conversations` — View all Q&A logs
                    - `GET /admin/logs/app` — View system logs
                    - `GET /admin/cache/stats` — View cache statistics
                    - `DELETE /admin/cache/clear` — Clear all cache
                    - `GET /admin/health` — Health check (Pinecone, MongoDB, OpenAI)
                    """,
    version="1.0.0",
    lifespan=lifespan,
    docs_url="/docs",
    redoc_url="/redoc",
)

# ── Attach rate limiter ────────────────────────────────
app.state.limiter = limiter
app.add_exception_handler(RateLimitExceeded, _rate_limit_exceeded_handler)
app.add_middleware(SlowAPIMiddleware)

# ── CORS ──────────────────────────────────────────────
cors_origins = [o.strip() for o in settings.cors_allow_origins.split(",") if o.strip()]
if not cors_origins:
    cors_origins = ["*"]

app.add_middleware(
    CORSMiddleware,
    allow_origins=cors_origins,
    allow_credentials=(cors_origins != ["*"]),
    allow_methods=["*"],
    allow_headers=["*"],
)

# ── Routers ───────────────────────────────────────────
app.include_router(user_router)
app.include_router(admin_router)

# ── Global error handler ──────────────────────────────
@app.exception_handler(Exception)
async def global_exception_handler(request: Request, exc: Exception):
    logger.error(f"Unhandled exception on {request.url}: {exc}")
    return JSONResponse(
        status_code=500,
        content={"detail": "Internal server error. Please try again later."},
    )

# ── Root ──────────────────────────────────────────────
@app.get("/", tags=["Root"])
async def root():
    return {
        "message": "RAG Chatbot API is running.",
        "docs": "/docs",
        "health": "/admin/health",
    }
