// ── Central API service ───────────────────────────────
// All calls to the RAG backend go through here.

const getBase = () => localStorage.getItem('rag_base_url') || 'http://localhost:8000'
const getKey  = () => localStorage.getItem('rag_admin_key') || ''

const adminHeaders = (extra = {}) => ({
  'X-Admin-API-Key': getKey(),
  ...extra,
})

async function request(path, options = {}) {
  const url = `${getBase()}${path}`
  const res = await fetch(url, options)
  if (!res.ok) {
    const err = await res.json().catch(() => ({ detail: res.statusText }))
    throw new Error(err.detail || `HTTP ${res.status}`)
  }
  return res.json()
}

// ── Health ────────────────────────────────────────────
export const fetchHealth = () =>
  request('/admin/health', { headers: adminHeaders() })

// ── Documents ─────────────────────────────────────────
export const fetchDocuments = () =>
  request('/admin/documents', { headers: adminHeaders() })

export const fetchDocumentVersions = (filename) =>
  request(`/admin/documents/${encodeURIComponent(filename)}/versions`, { headers: adminHeaders() })

export const uploadDocument = (file, onProgress) => {
  return new Promise((resolve, reject) => {
    const xhr = new XMLHttpRequest()
    const fd = new FormData()
    fd.append('file', file)
    xhr.open('POST', `${getBase()}/admin/upload`)
    xhr.setRequestHeader('X-Admin-API-Key', getKey())
    if (onProgress) {
      xhr.upload.addEventListener('progress', (e) => {
        if (e.lengthComputable) onProgress(Math.round((e.loaded / e.total) * 100))
      })
    }
    xhr.onload = () => {
      if (xhr.status >= 200 && xhr.status < 300) {
        resolve(JSON.parse(xhr.responseText))
      } else {
        const err = JSON.parse(xhr.responseText || '{}')
        reject(new Error(err.detail || `HTTP ${xhr.status}`))
      }
    }
    xhr.onerror = () => reject(new Error('Network error'))
    xhr.send(fd)
  })
}

export const deleteDocument = (filename) =>
  request(`/admin/document/${encodeURIComponent(filename)}`, {
    method: 'DELETE',
    headers: adminHeaders(),
  })

export const rollbackDocument = (filename, versionId) =>
  request(`/admin/documents/${encodeURIComponent(filename)}/rollback/${versionId}`, {
    method: 'POST',
    headers: adminHeaders(),
  })

// ── Sessions ──────────────────────────────────────────
export const fetchSessions = () =>
  request('/admin/sessions', { headers: adminHeaders() })

export const fetchSession = (sessionId) =>
  request(`/admin/sessions/${encodeURIComponent(sessionId)}`, { headers: adminHeaders() })

export const deleteSession = (sessionId) =>
  request(`/admin/sessions/${encodeURIComponent(sessionId)}`, {
    method: 'DELETE',
    headers: adminHeaders(),
  })

// ── Conversations log ─────────────────────────────────
export const fetchConversations = (limit = 200) =>
  request(`/admin/logs/conversations?limit=${limit}`, { headers: adminHeaders() })

// ── App logs ──────────────────────────────────────────
export const fetchAppLogs = (lines = 200) =>
  request(`/admin/logs/app?lines=${lines}`, { headers: adminHeaders() })

// ── Cache ─────────────────────────────────────────────
export const fetchCacheStats = () =>
  request('/admin/cache/stats', { headers: adminHeaders() })

export const clearCache = () =>
  request('/admin/cache/clear', {
    method: 'DELETE',
    headers: adminHeaders({ 'Content-Type': 'application/json' }),
    body: JSON.stringify({ confirm: true }),
  })
