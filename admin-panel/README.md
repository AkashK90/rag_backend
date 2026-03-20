# RAG Admin Panel

A dedicated developer-facing admin panel for the RAG backend.
Built with React + Vite. Completely optional — use it after your backend is working.

---

## Pages

| Page | Route | Purpose |
|------|-------|---------|
| Dashboard | `/` | System health, stats, activity chart, recent conversations |
| Knowledge Base | `/knowledge` | Upload documents, view inventory, manage versions |
| Documents | `/documents` | Separate zone: delete documents, rollback versions |
| Sessions | `/sessions` | Inspect user sessions, full conversation history, timestamps |
| System Logs | `/logs` | App logs (colored by level) + conversation logs with filters |
| Cache | `/cache` | Cache stats, when to clear, clear button |

---

## Setup

```bash
cd optional/admin-panel
npm install
npm run dev
```

Open: http://localhost:3001

---

## Connect to Backend

1. Enter your backend URL in the top bar (default: `http://localhost:8000`)
2. Enter your `ADMIN_USERNAME / ADMIN_PASSWORD`
3. Click **Connect** — the sidebar will show green status dots

Settings are saved to `localStorage` so you don't need to re-enter them.

---

## New Backend Endpoints (added for this panel)

These were added to the main backend in `app/api/admin_routes.py`:

| Endpoint | Description |
|----------|-------------|
| `GET /admin/documents` | List all ingested documents with metadata |
| `GET /admin/documents/{filename}/versions` | All versions of a document |
| `POST /admin/documents/{filename}/rollback/{version_id}` | Rollback to a previous version |

Version data is stored in `data/document_registry.json` on the backend server.

---

## Build for Production

```bash
npm run build
# Output in dist/ — serve with any static file server
```
