# RAG Chatbot Backend — Complete Developer Guide

A production-grade **Retrieval-Augmented Generation (RAG)** backend built with FastAPI,
OpenAI GPT-4, Pinecone, MongoDB, and LangChain. Designed for 50+ concurrent users with
document versioning, session memory, intelligent caching, and full developer observability.

---

## Table of Contents

1. [What This Project Does](#1-what-this-project-does)
2. [How It Works — The Full Flow](#2-how-it-works--the-full-flow)
3. [Project Structure](#3-project-structure)
4. [Technology Stack](#4-technology-stack)
5. [Three Sides of the System](#5-three-sides-of-the-system)
6. [Prerequisites](#6-prerequisites)
7. [Step 1 — Clone and Configure Environment](#7-step-1--clone-and-configure-environment)
8. [Step 2 — Create Pinecone Index](#8-step-2--create-pinecone-index)
9. [Step 3 — Run with Docker (Recommended)](#9-step-3--run-with-docker-recommended)
10. [Step 4 — Run Locally (Development)](#10-step-4--run-locally-development)
11. [Step 5 — Upload Your First Document](#11-step-5--upload-your-first-document)
12. [Step 6 — Test the Chat Endpoint](#12-step-6--test-the-chat-endpoint)
13. [All API Endpoints](#13-all-api-endpoints)
14. [Document Versioning](#14-document-versioning)
15. [Caching System](#15-caching-system)
16. [Session Memory](#16-session-memory)
17. [Monitoring and Logs](#17-monitoring-and-logs)
18. [Testing](#18-testing)
19. [Optional — RAG Tester HTML](#19-optional--rag-tester-html)
20. [Optional — Admin Panel React](#20-optional--admin-panel-react)
21. [Production Checklist](#21-production-checklist)
22. [Scaling Guide](#22-scaling-guide)
23. [Troubleshooting](#23-troubleshooting)

---

## 1. What This Project Does

This is the **backend only**. Your website's existing chatbot frontend calls one URL:

```
POST http://yourserver:8000/api/chat
```

The backend:
- Searches a knowledge base built from your PDFs and TXT files
- Retrieves the most relevant content using vector similarity search
- Generates a grounded, accurate answer using GPT-4
- Remembers the conversation history per user session
- Caches repeated questions for near-instant responses
- Logs every interaction for monitoring and business analysis

---

## 2. How It Works — The Full Flow

### Flow A — Document Ingestion (you upload a file)

```
You → POST /admin/upload (PDF or TXT)
         │
         ▼
  ① PARSE          PyMuPDF reads every page of the PDF
         │          TextLoader reads plain text files
         ▼
  ② CHUNK          Text split into 500-token overlapping chunks
         │          Overlap = 50 tokens to preserve context at boundaries
         ▼
  ③ EMBED          Each chunk → OpenAI text-embedding-3-small
         │          Returns a 1536-dimension vector per chunk
         ▼
  ④ STORE          Vector + original text + metadata saved in Pinecone
         │          Metadata includes: filename, page number, chunk index, version_id
         ▼
  ⑤ VERSION        Version entry written to data/document_registry.json
         │          Tracks: version_id, upload time, chunk count, all vector IDs
         ▼
  ✅ Done — chunks are now searchable, version is tracked, temp file deleted
```

### Flow B — User Chat (user sends a question)

```
User → POST /api/chat  { "question": "...", "session_id": "..." }
No authorization is required for `/api/chat` (public endpoint).
         │
         ▼
  ① CACHE CHECK       Is this question already cached in MongoDB?
         │             YES → return cached answer in ~5ms ⚡
         │ (cache miss)
         ▼
  ② EMBED QUERY       User question → OpenAI embedding vector (1536 dims)
         │
         ▼
  ③ RETRIEVE          Search Pinecone for top-5 most similar document chunks
         │             Returns relevant text + source filenames and page numbers
         ▼
  ④ LOAD MEMORY       Fetch conversation history for session_id from MongoDB
         │
         ▼
  ⑤ BUILD PROMPT      System prompt + context chunks + history + current question
         │
         ▼
  ⑥ GENERATE          Send full prompt to GPT-4 (temperature 0.2 for factual answers)
         │
         ▼
  ⑦ SAVE AND LOG      Store answer in MongoDB cache + update session memory + log to file
         │
         ▼
  ✅ Return { answer, sources, session_id, response_time_ms, cache_hit }
```

---

## 3. Project Structure

```
rag-backend/
│
├── main.py                          Entry point — FastAPI app, middleware, routers
├── requirements.txt                 All Python dependencies with pinned versions
├── Dockerfile                       Production container (Python 3.11-slim)
├── docker-compose.yml               Runs app (4 workers) + MongoDB together
├── pytest.ini                       Test configuration (asyncio_mode = auto)
├── .env.example                     Template for environment variables (safe to share)
├── .gitignore                       Excludes .env, logs, uploads, __pycache__
├── README.md                        This file
│
├── app/                             Main application package
│   │
│   ├── api/                         HTTP route handlers (what the outside world calls)
│   │   ├── __init__.py
│   │   ├── user_routes.py           👤 PUBLIC  — POST /api/chat only
No authorization is required for `/api/chat` (public endpoint).
│   │   └── admin_routes.py          🛠️ ADMIN   — all /admin/* endpoints
│   │
│   ├── core/                        Shared infrastructure and config
│   │   ├── __init__.py
│   │   ├── config.py                Reads .env into a validated Settings object
│   │   ├── security.py              Validates Basic Auth on all admin routes
│   │   └── dependencies.py          Shared Pinecone index + OpenAI embedding instances
│   │
│   ├── services/                    Business logic — each file does one job
│   │   ├── __init__.py
│   │   ├── ingestion_service.py     Load file → chunk → embed → store → register version
│   │   ├── retrieval_service.py     Embed query → search Pinecone → return top-K chunks
│   │   ├── generation_service.py    Build prompt → call GPT-4 → return answer string
│   │   ├── memory_service.py        Store and retrieve chat history in MongoDB per session
│   │   ├── cache_service.py         MongoDB answer cache with TTL expiry
│   │   └── document_version_service.py  Registry of document versions in JSON file
│   │
│   ├── chains/
│   │   ├── __init__.py
│   │   └── rag_chain.py             Orchestrates the complete RAG pipeline (steps 1–7)
│   │
│   ├── models/
│   │   ├── __init__.py
│   │   ├── request_models.py        Pydantic input validation (ChatRequest, ClearCacheRequest)
│   │   └── response_models.py       Pydantic output shapes (ChatResponse, DocumentRecord, etc.)
│   │
│   └── utils/
│       ├── __init__.py
│       ├── logger.py                Loguru setup — console + app.log + MongoDB conversations
│       └── helpers.py               make_cache_key(), extract_source_label(), truncate_text()
│
├── logs/                            Created automatically on first startup
│   ├── app.log                      System events, errors, warnings — rotates at 10MB, kept 30 days
│   ├── access.log                   HTTP access log from Gunicorn (Docker mode only)
│   └── MongoDB conversations          Every Q&A record with metadata
│
├── uploads/                         Temporary storage during ingestion — files deleted after processing
│
├── data/                            Created automatically on first document upload
│   └── document_registry.json       Full version history for all documents — persists across restarts
│
├── tests/
│   ├── __init__.py
│   ├── test_chat.py                 Validation tests + live chat pipeline test
│   ├── test_ingestion.py            Auth tests + file type tests + live upload test
│   └── test_cache.py                Cache key logic tests + MongoDB integration test
│
└── optional/                        Enhancement tools — use after backend is stable
    └── admin-panel/                 Full React developer console (see Section 20)
        ├── index.html               HTML entry point
        ├── package.json             Dependencies: React 18, Recharts, Lucide, date-fns
        ├── vite.config.js           Dev server port 3001, proxy to backend
        ├── README.md                Admin panel setup guide
        └── src/
            ├── main.jsx             React root with BrowserRouter
            ├── App.jsx              Route definitions and app layout
            ├── styles/global.css    Design system: CSS variables, animations, fonts
            ├── services/api.js      All HTTP calls to backend in one file
            ├── hooks/
            │   ├── useApi.js        Loading + error + data state wrapper
            │   └── useSettings.js   Persist baseUrl + adminKey in localStorage
            └── components/
                ├── layout/
                │   ├── Sidebar.jsx  Navigation links + system status indicators
                │   └── Topbar.jsx   URL input, admin key input, Connect button
                ├── ui/
                │   ├── Components.jsx  Button, Badge, Card, Table, Modal, StatCard, Input, etc.
                │   └── Toast.jsx       Global notification system (success, error, warn, info)
                └── pages/
                    ├── Dashboard.jsx      Health cards, stats, activity chart, recent Q&A
                    ├── KnowledgeBase.jsx  Upload zone + document inventory + version viewer
                    ├── Documents.jsx      Delete + rollback — intentionally separate danger zone
                    ├── Sessions.jsx       Session list + full conversation inspector
                    ├── Logs.jsx           App logs by level + conversation logs with filters
                    └── Cache.jsx          Cache stats + clear button + usage guidance
```

---

## 4. Technology Stack

| Layer | Technology | Version | Purpose |
|---|---|---|---|
| API Framework | FastAPI | 0.115.0 | Async REST API, automatic Swagger docs at /docs |
| Server | Gunicorn + Uvicorn | 23.0 / 0.30.6 | 4 async workers for 50 concurrent users |
| LLM | OpenAI GPT-4 | via API | Answer generation from context |
| Embeddings | OpenAI text-embedding-3-small | via API | Converts text to 1536-dim vectors |
| Vector Database | Pinecone | 5.0.1 | Managed vector similarity search |
| RAG Framework | LangChain | 0.3.1 | Document loaders, text splitters, chains |
| PDF Parsing | PyMuPDF | 1.24.10 | Extracts text from PDFs page by page |
| Cache + Memory | MongoDB 7 | via Docker | Response cache + per-session chat history |
| Logging | Loguru | 0.7.2 | Structured logs with automatic rotation |
| Retry Logic | Tenacity | 9.0.0 | Auto-retry on OpenAI and Pinecone failures |
| Rate Limiting | SlowAPI | 0.1.9 | 60 requests per minute per IP address |
| Config | Pydantic Settings | 2.5.2 | Typed environment variable loading |
| Testing | Pytest + HTTPX | 8.3.3 / 0.27.2 | Async API and integration tests |
| Container | Docker + Compose | latest | Single-command deployment |

---

## 5. Three Sides of the System

```
┌─────────────────────────────────────────────────────────────┐
│                    YOUR RAG SYSTEM                          │
├──────────────────┬──────────────────────┬───────────────────┤
│   👤 END USER    │  🛠️ DEVELOPER (YOU)   │   🤖 AI BRAIN     │
├──────────────────┼──────────────────────┼───────────────────┤
│ Asks questions   │ Uploads documents    │ Parses and chunks │
│ Gets answers     │ Monitors sessions    │ Generates vectors │
│ Conversation     │ Views logs and errors│ Searches Pinecone │
│ memory per       │ Manages document     │ Calls GPT-4       │
│ session ID       │ versions + rollback  │ Manages MongoDB     │
│                  │ Controls cache       │ Logs everything   │
├──────────────────┼──────────────────────┼───────────────────┤
│ POST /api/chat   │ POST /admin/upload   │ Internal — not    │
No authorization is required for `/api/chat` (public endpoint).
│ (public, no key) │ GET  /admin/sessions │ exposed via HTTP  │
│                  │ GET  /admin/logs/*   │                   │
│                  │ GET  /admin/health   │                   │
│                  │ (requires API key)   │                   │
└──────────────────┴──────────────────────┴───────────────────┘
```

---

## 6. Prerequisites

Before starting, make sure you have everything below:

| Requirement | Where to Get It | Notes |
|---|---|---|
| **OpenAI API Key** | platform.openai.com | Needs GPT-4 access and embedding access |
| **Pinecone API Key** | app.pinecone.io | Free tier works to get started |
| **Pinecone Index** | app.pinecone.io | You create this manually in Step 2 |
| **Docker Desktop** | docker.com/products/docker-desktop | Required for the recommended setup |
| **Python 3.11+** | python.org | Only needed for local development setup |

**Estimated monthly cost for light usage (around 1000 questions):**
- OpenAI GPT-4 generation: $5–15
- OpenAI Embeddings: $0.50
- Pinecone Free Tier: $0
- MongoDB (self-hosted via Docker): $0

---

## 7. Step 1 — Clone and Configure Environment

```bash
# Unzip the project folder
unzip rag-backend.zip
cd rag-backend

# Copy the environment template
cp .env.example .env
```

Open `.env` in any text editor and fill in your values:

```env
# ── OpenAI ────────────────────────────────────────────────
OPENAI_API_KEY=sk-...                          # Your OpenAI secret key
OPENAI_EMBEDDING_MODEL=text-embedding-3-small  # Do not change — dimension must match Pinecone
OPENAI_CHAT_MODEL=gpt-4                        # Or gpt-4-turbo for faster/cheaper responses

# ── Pinecone ──────────────────────────────────────────────
PINECONE_API_KEY=pcsk-...            # Your Pinecone API key
PINECONE_INDEX_NAME=rag-index        # Must exactly match the index name you create in Step 2
PINECONE_ENVIRONMENT=us-east-1       # Must match your Pinecone index region

# ── MongoDB ─────────────────────────────────────────────────
MONGODB_URI=mongodb://mongodb:27017         # Keep this for Docker setup
                                     # Change to mongodb://localhost:27017 for local setup
MONGODB_DB=rag_backend                       # Database name for cache + sessions

# ── Admin Security ─────────────────────────────────────────
ADMIN_USERNAME=admin
ADMIN_PASSWORD=change-this-to-a-long-random-secret
ADMIN_TOKEN_TTL_SECONDS=86400

# ── App Settings (optional — defaults are good to start) ──
APP_ENV=production
LOG_LEVEL=INFO
MAX_UPLOAD_SIZE_MB=50
CHUNK_SIZE=500
CHUNK_OVERLAP=50
TOP_K_RESULTS=5
CACHE_TTL_SECONDS=3600      # Cache answers for 1 hour
SESSION_TTL_SECONDS=86400   # Keep sessions alive for 24 hours
```

**Files active after this step:**
```
rag-backend/
├── .env                      ← Your private config — never commit to Git
├── .env.example              ← Safe template already in the project
└── app/core/config.py        ← Reads all .env values into a typed Settings object
```

---

## 8. Step 2 — Create Pinecone Index

Log in to [app.pinecone.io](https://app.pinecone.io) and create a new index with **exactly** these settings:

| Setting | Required Value |
|---|---|
| Index name | Must match `PINECONE_INDEX_NAME` in your `.env` exactly |
| Dimensions | **1536** — required for OpenAI text-embedding-3-small |
| Metric | **cosine** |
| Cloud provider | AWS (recommended) |
| Region | Must match `PINECONE_ENVIRONMENT` in your `.env` |

> ⚠️ The dimension value 1536 is fixed to the embedding model. If you ever switch to a
> different embedding model, you must create a new index with the correct dimension.

**Files that connect to this index:**
```
rag-backend/
├── app/core/dependencies.py          ← Connects to Pinecone index on startup (cached)
└── app/services/
    ├── ingestion_service.py          ← Writes vectors to this index during upload
    └── retrieval_service.py          ← Reads vectors from this index during chat
```

---

## 9. Step 3 — Run with Docker (Recommended)

One command starts both the app and MongoDB:

```bash
# Build containers and start in the background
docker-compose up --build -d
```

This starts:
- **`rag-backend`** — FastAPI with 4 Gunicorn workers on port `8000`
- **`rag-mongodb`** — MongoDB 7 on port `27017` with a persistent data volume

```bash
# Verify both containers are running
docker-compose ps

# Watch live application logs
docker-compose logs -f app

# Watch MongoDB logs
docker-compose logs -f mongodb

# Stop all services
docker-compose down

# Stop and wipe all data including MongoDB cache and sessions
docker-compose down -v
```

**Verify the server is running:**
```bash
curl http://localhost:8000/
```
Expected response:
```json
{"message": "RAG Chatbot API is running.", "docs": "/docs", "health": "/admin/health"}
```

**Files active after this step:**
```
rag-backend/
├── Dockerfile              ← Builds the Python container image
├── docker-compose.yml      ← Defines both services + volumes + networking
├── main.py                 ← FastAPI app entry point (runs inside the container)
├── requirements.txt        ← Installed inside the container during build
└── logs/                   ← Created inside container, mounted to your disk
    └── app.log             ← Startup and request events appear here immediately
```

---

## 10. Step 4 — Run Locally (Development)

Use this if you want auto-reload during development or prefer not to use Docker.

```bash
# Create a Python virtual environment
python -m venv venv

# Activate the virtual environment
source venv/bin/activate        # macOS and Linux
venv\Scripts\activate           # Windows

# Install all dependencies
pip install -r requirements.txt
```

> ⚠️ You still need MongoDB running. Easiest option (all OS):
>
> `docker run -d --name rag-mongodb -p 27017:27017 mongo:7`

Also update your `.env` for local MongoDB:
```env
MONGODB_URI=mongodb://localhost:27017
```

```bash
# Start with hot-reload for development
uvicorn main:app --reload --port 8000
uvicorn main:app --reload --port 8000 --env-file .env # it includes all items which is in .env
# Start production-style (4 workers, no reload)
gunicorn main:app --worker-class uvicorn.workers.UvicornWorker --workers 4 --bind 0.0.0.0:8000
```

**Files active after this step:**
```
rag-backend/
├── main.py                         ← FastAPI app starts here
├── app/
│   ├── api/user_routes.py          ← Registers POST /api/chat
No authorization is required for `/api/chat` (public endpoint).
│   ├── api/admin_routes.py         ← Registers all /admin/* routes
│   ├── core/config.py              ← Loads settings from .env
│   ├── core/security.py            ← Admin key header validation
│   ├── core/dependencies.py        ← Connects to Pinecone and OpenAI
│   └── utils/logger.py             ← Creates log files on startup
└── logs/
    └── app.log                     ← Created on first request
```

---

## 11. Step 5 — Upload Your First Document

With the server running, ingest a document to build the knowledge base.

**Using curl (terminal):**
```bash
curl -X POST http://localhost:8000/admin/upload \
  -u "admin:your-password" \
  -F "file=@Akash_cv_datalink.pdf"
```

**Expected response:**
```json
{
  "filename": "document.pdf",
  "chunks_ingested": 47,
  "message": "Successfully ingested 47 chunks from document.pdf"
}
```

**Using the browser (Swagger UI):**

Go to `http://localhost:8000/docs`, open `POST /admin/upload`, click "Try it out", add your API key in the Authorize button at the top, then upload the file.

**What happens internally after the upload command:**
```
document.pdf received by FastAPI (app/api/admin_routes.py)
    │
    ▼
app/services/ingestion_service.py
    ├── Generates a new version_id (e.g. va3b1c2d)
    ├── PyMuPDFLoader extracts text from each page
    ├── RecursiveCharacterTextSplitter creates 47 chunks
    ├── Each chunk gets a unique UUID as its vector ID
    ├── All 47 chunks sent to OpenAI embedding API in batches
    ├── 47 vectors + text + metadata stored in Pinecone
    └── Calls document_version_service.register_version()
             │
             ▼
         app/services/document_version_service.py
             └── Writes version entry to data/document_registry.json
```

**Files active after this step:**
```
rag-backend/
├── app/services/ingestion_service.py          ← Runs the full ingestion pipeline
├── app/services/document_version_service.py   ← Registers the new version
├── data/
│   └── document_registry.json                 ← Created here, now contains your document
└── logs/
    └── app.log                                ← Ingestion events logged with chunk counts
```

After a successful upload, `data/document_registry.json` will look like this:
```json
{
  "document.pdf": {
    "current_version_id": "va3b1c2d",
    "versions": {
      "va3b1c2d": {
        "version_id": "va3b1c2d",
        "filename": "document.pdf",
        "uploaded_at": "2026-03-16T10:30:00+00:00",
        "chunks": 47,
        "size_bytes": 204800,
        "is_current": true,
        "vector_ids": ["uuid-1", "uuid-2", "...47 total"]
      }
    }
  }
}
```

---

## 12. Step 6 — Test the Chat Endpoint

This is the **only endpoint your website frontend ever needs to call**.

**First request (no cache):**
```bash
curl -X POST http://localhost:8000/api/chat \
  -H "Content-Type: application/json" \
  -d '{"question": "What is the refund policy?", "session_id": "test-user-001"}'
```

**Expected response:**
```json
{
  "answer": "According to the policy document, refunds are processed within 7 business days...",
  "sources": ["document.pdf — page 3"],
  "session_id": "test-user-001",
  "response_time_ms": 1243,
  "cache_hit": false
}
```

**Same question again (cache hit):**
```bash
curl -X POST http://localhost:8000/api/chat \
  -H "Content-Type: application/json" \
  -d '{"question": "What is the refund policy?", "session_id": "test-user-001"}'
```

**Expected response — notice cache_hit and response_time_ms:**
```json
{
  "answer": "According to the policy document, refunds are processed within 7 business days...",
  "sources": ["document.pdf — page 3"],
  "session_id": "test-user-001",
  "response_time_ms": 5,
  "cache_hit": true
}
```

**Files active during every chat request:**
```
rag-backend/
├── app/api/user_routes.py              ← Receives and validates the request
├── app/chains/rag_chain.py             ← Runs steps 1 through 7 in sequence
├── app/services/cache_service.py       ← Step 1: check MongoDB for cached answer
├── app/services/memory_service.py      ← Step 2: load session history from MongoDB
├── app/services/retrieval_service.py   ← Step 3: search Pinecone for relevant chunks
├── app/services/generation_service.py  ← Step 4: call GPT-4 with full prompt
└── app/utils/logger.py                 ← Appends record to MongoDB conversations collection
```

---

## 13. All API Endpoints

### 👤 Public Endpoints — no authentication required

| Method | Endpoint | Description |
|---|---|---|
| `GET` | `/` | Confirms server is running |
| `POST` | `/api/chat` | Send a question, receive a grounded answer |
| `GET` | `/docs` | Interactive Swagger UI — test all endpoints |
| `GET` | `/redoc` | Alternative API reference documentation |

**POST /api/chat — Request body:**
No authorization is required for `/api/chat` (public endpoint).
```json
{
  "question": "string — required, 1 to 2000 characters",
  "session_id": "string — required, 1 to 100 characters"
}
```

**POST /api/chat — Response:**
No authorization is required for `/api/chat` (public endpoint).
```json
{
  "answer": "string",
  "sources": ["filename — page N"],
  "session_id": "string",
  "response_time_ms": 1243,
  "cache_hit": false
}
```

---

### 🛠️ Admin Endpoints — require HTTP Basic Auth

All admin endpoints require this header on every request:
```
Use Basic Auth with username + password. Example: `-u "admin:your-password"`
```

#### Document Ingestion and Management

| Method | Endpoint | Description |
|---|---|---|
| `POST` | `/admin/upload` | Upload a PDF or TXT file — parse, chunk, embed, store, version |
| `DELETE` | `/admin/document/{filename}` | Permanently delete all vectors for a document |
| `GET` | `/admin/documents` | List all ingested documents with metadata |
| `GET` | `/admin/documents/{filename}/versions` | List all versions of a specific document |
| `POST` | `/admin/documents/{filename}/rollback/{version_id}` | Restore a previous version |

#### Session Management

| Method | Endpoint | Description |
|---|---|---|
| `GET` | `/admin/sessions` | List all active session IDs in MongoDB |
| `GET` | `/admin/sessions/{session_id}` | View full conversation history for a session |
| `DELETE` | `/admin/sessions/{session_id}` | Delete a session from MongoDB |

#### Logs and Monitoring

| Method | Endpoint | Query Params | Description |
|---|---|---|---|
| `GET` | `/admin/logs/conversations` | `?limit=100` | Last N Q&A records from MongoDB conversations |
| `GET` | `/admin/logs/app` | `?lines=100` | Last N lines from app.log |
| `GET` | `/admin/health` | — | Live connectivity check for Pinecone, MongoDB, OpenAI |

#### Cache

| Method | Endpoint | Description |
|---|---|---|
| `GET` | `/admin/cache/stats` | Total cached keys and TTL setting |
| `DELETE` | `/admin/cache/clear` | Clear all cached responses — body must be `{"confirm": true}` |

---

## 14. Document Versioning

Every time you upload a file, a new version is created. Previous versions are preserved
in Pinecone and can be restored at any time.

### How versioning works

```
First upload: policy.pdf
  └── version_id: va3b1c2d  ← current ✅

Second upload: policy.pdf (updated content)
  ├── version_id: vf7e2a91  ← current ✅
  └── version_id: va3b1c2d  ← archived

Roll back to va3b1c2d:
  ├── version_id: va3b1c2d  ← current ✅ (restored)
  └── version_id: vf7e2a91  ← archived (deactivated)
```

### List versions of a document

```bash
curl http://localhost:8000/admin/documents/policy.pdf/versions \
  -u "admin:your-password"
```

### Roll back to a previous version

```bash
curl -X POST "http://localhost:8000/admin/documents/policy.pdf/rollback/va3b1c2d" \
  -u "admin:your-password"
```

### Where version data is stored

All version history lives in `data/document_registry.json` on your server disk.
This file is mounted as a Docker volume so it survives container restarts and rebuilds.

**Files involved in versioning:**
```
rag-backend/
├── app/services/document_version_service.py   ← Reads and writes the registry
├── app/services/ingestion_service.py          ← Calls register_version() after each upload
├── app/api/admin_routes.py                    ← Exposes list versions + rollback endpoints
└── data/document_registry.json               ← The registry file (created at runtime)
```

---

## 15. Caching System

### How it works

Every generated answer is stored in MongoDB using a SHA-256 hash of the normalized question.

```
User asks:  "What is the refund policy?"
             ↓ normalize: lowercase + trim whitespace
             ↓ SHA-256
MongoDB key:  cache:exact:a3f7b2c1d4e5f6...
MongoDB value: { "answer": "...", "sources": [...] }
```

When the same (or identically normalized) question is asked again:
- MongoDB returns the cached answer quickly (usually a few ms depending on disk)
- No OpenAI API call is made — saves cost and time

### Cache TTL

Default: 1 hour. Controlled by `CACHE_TTL_SECONDS` in `.env`.
After the TTL expires, the next ask re-runs the full RAG pipeline and refreshes the cache.

### When you should clear the cache

```bash
curl -X DELETE http://localhost:8000/admin/cache/clear \
  -u "admin:your-password" \
  -H "Content-Type: application/json" \
  -d '{"confirm": true}'
```

Clear the cache after:
- Uploading new or updated documents — old cached answers may be incomplete
- Rolling back a document version — context has changed
- Changing the system prompt in `app/services/generation_service.py`
- Debugging a question that seems to return a wrong cached answer

**Files involved in caching:**
```
rag-backend/
├── app/services/cache_service.py    ← get_cached_answer(), set_cached_answer(), clear
├── app/chains/rag_chain.py          ← Checks cache before running the RAG pipeline
└── app/utils/helpers.py             ← make_cache_key() — normalizes and hashes the question
```

---

## 16. Session Memory

Each user is identified by a `session_id` string that your frontend generates and sends with every message. The full conversation history is stored in MongoDB and included in every GPT-4 call so the model can reference earlier messages.

### How memory works

```
Turn 1:
  User:      "What is the return window?"
  History:   [] (empty — first message)
  GPT-4 sees: [System] + [Human: "What is the return window?"]
  Answer:    "The return window is 30 days from purchase."
  Saved:     [Human: "What is..."] + [AI: "The return window..."]

Turn 2:
  User:      "Does that apply to digital products?"
  History:   2 messages loaded from MongoDB
  GPT-4 sees: [System] + [Human: "What is..."] + [AI: "30 days..."] + [Human: "Does that apply..."]
  Answer:    "Yes, the 30-day window applies to digital products as well."  ← context-aware ✅
```

### Session TTL

Default: 24 hours. After no activity for 24 hours, the session is automatically removed
from MongoDB. Controlled by `SESSION_TTL_SECONDS` in `.env`.

**Files involved in session memory:**
```
rag-backend/
├── app/services/memory_service.py    ← get_session_history(), save_session_history()
├── app/chains/rag_chain.py           ← Loads history before and saves after every answer
└── docker-compose.yml                ← MongoDB with persistent volume (data survives restarts)
```

---

## 17. Monitoring and Logs

### Log files on disk

| File | Location | What It Contains | Rotation |
|---|---|---|---|
| System log | `logs/app.log` | Startup events, requests, warnings, errors | 10MB → zipped, kept 30 days |
| Access log | `logs/access.log` | HTTP request log from Gunicorn | Docker mode only |
| Conversations | `MongoDB conversations collection` | Every Q&A with full metadata | Manual — grows indefinitely |

### MongoDB conversations format

Each line is one complete Q&A record in JSON format:
```json
{
  "timestamp": "2026-03-16T10:23:45+00:00",
  "session_id": "user-42",
  "question": "What is the refund policy?",
  "answer": "Refunds are processed within 7 business days from the return approval...",
  "sources": ["policy.pdf — page 3"],
  "response_time_ms": 1243,
  "cache_hit": false
}
```

### Read logs via API

```bash
# Last 50 conversation records (newest first)
curl "http://localhost:8000/admin/logs/conversations?limit=50" \
  -u "admin:your-password"

# Last 100 system log lines (newest first)
curl "http://localhost:8000/admin/logs/app?lines=100" \
  -u "admin:your-password"
```

### Health check

```bash
curl http://localhost:8000/admin/health \
  -u "admin:your-password"
```

Expected when everything is healthy:
```json
{
  "status": "healthy",
  "pinecone": "ok",
  "mongodb": "ok",
  "openai": "ok"
}
```

If any service shows an error message instead of "ok", that service has a connectivity
or authentication problem. Check `logs/app.log` for the full error.

**Files involved in logging:**
```
rag-backend/
├── app/utils/logger.py           ← Loguru config, log_conversation() function
├── app/chains/rag_chain.py       ← Calls log_conversation() after every answer
└── app/api/admin_routes.py       ← Reads log files and serves them via API
```

---

## 18. Testing

```bash
# Activate virtual environment first (local setup)
source venv/bin/activate

# Run all tests
pytest tests/ -v

# Run only unit tests that need no API keys
pytest tests/test_cache.py -v

# Run all tests with live API keys
OPENAI_API_KEY=sk-... pytest tests/ -v
```

### What each test covers

| File | What It Tests | Needs API Keys |
|---|---|---|
| `tests/test_chat.py` | Missing question → 422, missing session → 422, full response shape | Live test only |
| `tests/test_ingestion.py` | No auth → 403, CSV file → 400, TXT upload end-to-end | Live test only |
| `tests/test_cache.py` | Key determinism, normalization equality, MongoDB set and get | MongoDB test only |

**Files active when running tests:**
```
rag-backend/
├── pytest.ini              ← asyncio_mode = auto (required for async test functions)
├── tests/__init__.py       ← Makes tests importable as a package
├── tests/test_chat.py
├── tests/test_ingestion.py
└── tests/test_cache.py
```

---

## 19. Optional — RAG Tester HTML

A standalone single-file browser tool for testing your backend before connecting your real website frontend.

**How to use:**
1. Download `rag-tester.html` (separate from this zip)
2. Double-click to open in any browser — no server or install needed
3. Enter your backend URL (e.g. `http://localhost:8000`)
4. Click **⚡ Ping** to verify connection
5. Enter your `ADMIN_USERNAME / ADMIN_PASSWORD`
6. Drag and drop documents to upload them
7. Type questions in the chat panel

**What this tool includes:**
- Full chat interface with typing animation, source display, cache/live badges
- Drag-and-drop document upload with real-time progress percentage
- Session list and viewer
- Cache stats and clear button
- Real-time activity log with category filter (All / Chat / Admin)
- Live stats: total requests, cache hits, average response time, error count

> This file has no build step and no dependencies — open it directly in Chrome, Firefox, or Safari.

---

## 20. Optional — Admin Panel React

A full developer console built in React for managing the RAG system in production.
Located at `optional/admin-panel/`. Use this once your backend is stable.

### Setup and start

```bash
cd optional/admin-panel
npm install
npm run dev
```

Open: **http://localhost:3001**

Enter your backend URL and admin key in the top bar, then click **Connect**.
Settings are saved to browser localStorage so you do not need to re-enter them on refresh.

### Six pages

| Page | Route | What You Can Do Here |
|---|---|---|
| **Dashboard** | `/` | System health cards, stats grid, activity chart, recent conversations |
| **Knowledge Base** | `/knowledge` | Upload documents with progress bar, view inventory, browse version history |
| **Documents** | `/documents` | Delete documents, rollback versions — intentionally a separate danger zone |
| **Sessions** | `/sessions` | Search sessions, inspect full conversation history, view MongoDB memory, delete sessions |
| **System Logs** | `/logs` | App logs colored by level (INFO/WARNING/ERROR), conversation logs with search and date filter |
| **Cache** | `/cache` | Cache stats, guidance on when to clear, clear button with confirmation |

### Why Documents is a separate page

Uploading new knowledge (Knowledge Base page) and modifying existing knowledge
(Documents page) are different risk levels. Keeping them separate prevents a developer
from accidentally deleting production documents while trying to upload new ones.

### Build for production deployment

```bash
cd optional/admin-panel
npm run build
# Static files output to dist/ — serve with nginx or any static file server
```

**Files in the admin panel:**
```
optional/admin-panel/
├── index.html                               HTML shell
├── package.json                             React 18, Recharts, Lucide, date-fns
├── vite.config.js                           Port 3001, proxy /admin/* and /api/* to backend
└── src/
    ├── main.jsx                             React entry with BrowserRouter
    ├── App.jsx                              All routes defined here
    ├── styles/global.css                    CSS variables, fonts (Outfit + DM Mono), animations
    ├── services/api.js                      All fetch calls — single source of truth
    ├── hooks/
    │   ├── useApi.js                        Wraps any API call with loading/error/data state
    │   └── useSettings.js                   Persists baseUrl and adminKey in localStorage
    └── components/
        ├── layout/
        │   ├── Sidebar.jsx                  Nav links + live health status dots
        │   └── Topbar.jsx                   URL + key inputs + Connect button
        ├── ui/
        │   ├── Components.jsx               Button, Badge, Card, Spinner, Modal, Table, etc.
        │   └── Toast.jsx                    Global notification system
        └── pages/
            ├── Dashboard.jsx
            ├── KnowledgeBase.jsx
            ├── Documents.jsx
            ├── Sessions.jsx
            ├── Logs.jsx
            └── Cache.jsx
```

---

## 21. Production Checklist

Go through every item before serving real users:

```
Security
  [ ] Set a strong ADMIN_USERNAME / ADMIN_PASSWORD in .env (use 32+ random characters)
  [ ] Lock CORS in main.py to your actual frontend domain
        Change: allow_origins=["*"]
        To:     allow_origins=["https://yourwebsite.com"]
  [ ] Confirm .env is in .gitignore and never committed to version control
  [ ] Put the server behind HTTPS using nginx + Let's Encrypt

Infrastructure
  [ ] Pinecone index created with dimension 1536 and metric cosine
  [ ] docker-compose up --build -d starts without errors
  [ ] curl localhost:8000/admin/health returns all "ok"

Knowledge Base
  [ ] All documents uploaded via POST /admin/upload
  [ ] Each upload returns a reasonable chunk count (roughly 1 chunk per paragraph)
  [ ] Test 10+ real questions via POST /api/chat and verify answers are accurate
No authorization is required for `/api/chat` (public endpoint).

Monitoring
  [ ] logs/app.log exists and is being written to
  [ ] MongoDB conversations collection records appear after the first chat request
  [ ] data/document_registry.json exists after the first upload
  [ ] curl localhost:8000/admin/logs/conversations returns real records

Ongoing
  [ ] Schedule regular review of MongoDB conversations for business insights
  [ ] Clear cache after every knowledge base update
  [ ] Monitor logs/app.log for ERROR entries after any code change
```

---

## 22. Scaling Guide

### Current capacity

The default setup (4 Gunicorn workers + single MongoDB) handles approximately **50 concurrent users** comfortably with sub-2-second response times on cache misses.

### Increasing capacity

**100–200 concurrent users — increase workers:**
```dockerfile
# In Dockerfile, change the CMD line
CMD ["gunicorn", "main:app", "--workers", "8", ...]
```

**200–500 concurrent users — run multiple instances:**
```yaml
# In docker-compose.yml
app:
  deploy:
    replicas: 3
```
Add a load balancer (nginx or AWS ALB) in front of the replicas.

**500+ concurrent users — managed cloud infrastructure:**
- MongoDB → MongoDB Atlas or a self-managed replica set
- App → AWS ECS, GCP Cloud Run, or Kubernetes
- Logs → AWS CloudWatch or Datadog (add handler in `app/utils/logger.py`)
- Large file ingestion → Celery + RabbitMQ or SQS (background processing)

### Easy future enhancements

Every enhancement below requires changes to only one or two files:

| Enhancement | File to Change |
|---|---|
| Switch GPT-4 to Claude or Gemini | `app/services/generation_service.py` only |
| Add DOCX or Excel file support | `app/services/ingestion_service.py` only |
| Add streaming responses (SSE) | `app/api/user_routes.py` + `generation_service.py` |
| Push logs to Datadog or CloudWatch | `app/utils/logger.py` — add a handler |
| Add JWT user authentication | New `app/core/auth.py` + add dependency to routes |
| Isolate documents per customer | Add `customer_id` metadata filter in Pinecone queries |
| Semantic cache (similar questions) | `app/services/cache_service.py` — add vector comparison |
| Add LangGraph multi-agent support | New `app/agents/` folder, update `app/chains/rag_chain.py` |

---

## 23. Troubleshooting

### Server will not start

**Error: field required — openai_api_key**
```
Cause:   .env file missing or OPENAI_API_KEY not set
Fix:     Run: cp .env.example .env  then fill in your keys
```

**Error: Cannot connect to Pinecone**
```
Cause:   Wrong API key, wrong index name, or wrong region
Fix:     Check PINECONE_API_KEY and PINECONE_INDEX_NAME in .env
         Verify the index exists at app.pinecone.io
         Verify PINECONE_ENVIRONMENT matches the index region exactly
```

**Error: MongoDB connection refused**
```
Cause:   MongoDB is not running
Fix (Docker):  docker-compose up -d mongodb
Fix (macOS):   brew services start MongoDB
Fix (Linux):   sudo service MongoDB-server start
```

### Upload fails

**Error: Only PDF and TXT files are supported**
```
Cause:  Uploaded a .docx, .csv, or other unsupported file type
Fix:    Convert to PDF (print to PDF) or copy content to a .txt file
```

**Error: File too large**
```
Cause:  File exceeds MAX_UPLOAD_SIZE_MB (default 50MB)
Fix:    Increase MAX_UPLOAD_SIZE_MB in .env and restart the server
```

**Error: Ingestion failed — 500**
```
Cause:  Usually OpenAI API key invalid, Pinecone index not found, or quota exceeded
Fix:    Check logs/app.log for the specific error message
        Run the health check: curl localhost:8000/admin/health -u "admin:your-password"
```

### Chat returns wrong or outdated answers

**Possible cause 1 — Document not uploaded:**
```bash
curl http://localhost:8000/admin/documents -u "admin:your-password"
# Check that your document appears in the list
```

**Possible cause 2 — Cache serving old answer:**
```bash
curl -X DELETE localhost:8000/admin/cache/clear \
  -u "admin:your-password" \
  -H "Content-Type: application/json" \
  -d '{"confirm": true}'
```

**Possible cause 3 — Not enough chunks retrieved:**
```
Fix: Increase TOP_K_RESULTS from 5 to 8 or 10 in .env and restart
```

**Possible cause 4 — Chunks too small:**
```
Fix: Increase CHUNK_SIZE from 500 to 800 in .env
     Then re-upload all documents (old chunks remain at old size)
```

### Admin endpoints return 403

```
Cause:  Basic Auth credentials are missing or incorrect
Fix:    Check your header: -u "admin:your-password"
        The value must match ADMIN_USERNAME / ADMIN_PASSWORD in .env exactly
```

---

## Quick Reference Card

Copy and use these commands any time:

```bash
# Start server
docker-compose up --build -d

# Stop server
docker-compose down

# Watch live logs
docker-compose logs -f app

# Health check
curl localhost:8000/admin/health -u "admin:your-password"

# Upload a document
curl -X POST localhost:8000/admin/upload \
  -u "admin:your-password" \
  -F "file=@/path/to/file.pdf"

# List all documents
curl localhost:8000/admin/documents -u "admin:your-password"

# Test chat
curl -X POST localhost:8000/api/chat \
  -H "Content-Type: application/json" \
  -d '{"question":"Your question here","session_id":"test-001"}'

# Clear cache
curl -X DELETE localhost:8000/admin/cache/clear \
  -u "admin:your-password" \
  -H "Content-Type: application/json" \
  -d '{"confirm":true}'

# View last 20 conversations
curl "localhost:8000/admin/logs/conversations?limit=20" -u "admin:your-password"

# View last 50 system log lines
curl "localhost:8000/admin/logs/app?lines=50" -u "admin:your-password"

# List document versions
curl "localhost:8000/admin/documents/file.pdf/versions" -u "admin:your-password"

# Rollback document to a version
curl -X POST "localhost:8000/admin/documents/file.pdf/rollback/va3b1c2d" \
  -u "admin:your-password"

# Run tests
pytest tests/ -v

# Open Swagger UI
open http://localhost:8000/docs

# Start admin panel
cd optional/admin-panel && npm install && npm run dev
# Then open http://localhost:3001
```



In Swagger UI (/docs), when you click Authorize, it shows the token because Swagger wants you to paste it manually.
In the admin panel, you only enter username + password. The panel uses HTTP Basic Auth with the username and password you enter.
