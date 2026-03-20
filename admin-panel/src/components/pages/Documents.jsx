import React, { useEffect, useState } from 'react'
import {
  Button, Badge, Card, Spinner, Modal, ConfirmModal,
  Table, EmptyState, SectionHeader,
} from '../ui/Components'
import {
  fetchDocuments, deleteDocument, fetchDocumentVersions, rollbackDocument,
} from '../../services/api'
import { useToast } from '../ui/Toast'
import { format, formatDistanceToNow } from 'date-fns'

export default function Documents() {
  const toast = useToast()
  const [docs,           setDocs]           = useState([])
  const [loading,        setLoading]        = useState(true)
  const [selectedDoc,    setSelectedDoc]    = useState(null)
  const [versions,       setVersions]       = useState([])
  const [versionsLoading,setVersionsLoading]= useState(false)
  const [deleteTarget,   setDeleteTarget]   = useState(null)
  const [deleting,       setDeleting]       = useState(false)
  const [rollbackTarget, setRollbackTarget] = useState(null)
  const [rollingBack,    setRollingBack]    = useState(false)
  const [search,         setSearch]         = useState('')

  const load = async () => {
    setLoading(true)
    try { setDocs(await fetchDocuments()) }
    catch (e) { toast.error(e.message) }
    finally { setLoading(false) }
  }

  useEffect(() => { load() }, [])

  const loadVersions = async (filename) => {
    setSelectedDoc(filename)
    setVersionsLoading(true)
    try { setVersions(await fetchDocumentVersions(filename)) }
    catch (e) { toast.error(e.message) }
    finally { setVersionsLoading(false) }
  }

  const handleDelete = async () => {
    setDeleting(true)
    try {
      const res = await deleteDocument(deleteTarget)
      toast.success(`Deleted — ${res.vectors_deleted} vectors removed`)
      setDeleteTarget(null)
      if (selectedDoc === deleteTarget) setSelectedDoc(null)
      load()
    } catch (e) { toast.error(e.message) }
    finally { setDeleting(false) }
  }

  const handleRollback = async () => {
    setRollingBack(true)
    try {
      const res = await rollbackDocument(rollbackTarget.filename, rollbackTarget.version_id)
      toast.success(`Rolled back — ${res.chunks_restored} chunks restored`)
      setRollbackTarget(null)
      loadVersions(rollbackTarget.filename)
      load()
    } catch (e) { toast.error(e.message) }
    finally { setRollingBack(false) }
  }

  const filtered = docs.filter(d => d.filename.toLowerCase().includes(search.toLowerCase()))

  return (
    <div className="animate-fade" style={{ padding: 28, display: 'flex', flexDirection: 'column', gap: 24 }}>
      <SectionHeader
        title="Document Management"
        description="This section is intentionally separate from uploads. Modify or delete existing knowledge sources with caution."
      />

      {/* Warning banner */}
      <div style={{
        padding: '12px 16px', borderRadius: 'var(--radius)',
        background: 'rgba(245,166,35,0.08)', border: '1px solid rgba(245,166,35,0.3)',
        display: 'flex', gap: 10, alignItems: 'flex-start',
      }}>
        <span style={{ fontSize: 16 }}>⚠</span>
        <div>
          <div style={{ fontSize: 13, fontWeight: 600, color: 'var(--amber)', marginBottom: 3 }}>Developer Zone</div>
          <div style={{ fontSize: 12, color: 'var(--text-secondary)', lineHeight: 1.5 }}>
            Actions here directly modify the Pinecone vector store. Deletion is permanent for all versions unless
            rolled back. Every version history is stored locally in <code style={{ fontFamily: 'var(--mono)', background: 'var(--bg-hover)', padding: '1px 4px', borderRadius: 3 }}>data/document_registry.json</code>.
          </div>
        </div>
      </div>

      <div style={{ display: 'grid', gridTemplateColumns: '1fr 400px', gap: 20, alignItems: 'start' }}>

        {/* Left: Document list */}
        <Card padding={0}>
          <div style={{ padding: '12px 16px', borderBottom: '1px solid var(--border)', display: 'flex', gap: 10, alignItems: 'center' }}>
            <input
              placeholder="Search documents…"
              value={search}
              onChange={e => setSearch(e.target.value)}
              style={{
                flex: 1, background: 'var(--bg-raised)', border: '1px solid var(--border-md)',
                borderRadius: 6, padding: '6px 10px', fontSize: 12, color: 'var(--text-primary)',
                outline: 'none', fontFamily: 'var(--sans)',
              }}
            />
            <Button variant="ghost" size="sm" onClick={load} icon="↻">Refresh</Button>
          </div>
          {loading ? (
            <div style={{ padding: 40, display: 'flex', justifyContent: 'center' }}><Spinner /></div>
          ) : filtered.length === 0 ? (
            <EmptyState icon="📭" title="No documents" description="Upload documents from the Knowledge Base page." />
          ) : (
            filtered.map((doc, i) => (
              <div
                key={i}
                onClick={() => loadVersions(doc.filename)}
                style={{
                  padding: '12px 16px', borderBottom: '1px solid var(--border)',
                  cursor: 'pointer', transition: 'background 0.15s',
                  background: selectedDoc === doc.filename ? 'var(--bg-active)' : 'transparent',
                  display: 'flex', alignItems: 'center', gap: 12,
                }}
                onMouseEnter={e => { if (selectedDoc !== doc.filename) e.currentTarget.style.background = 'var(--bg-hover)' }}
                onMouseLeave={e => { if (selectedDoc !== doc.filename) e.currentTarget.style.background = 'transparent' }}
              >
                <div style={{ flex: 1, minWidth: 0 }}>
                  <div style={{ fontSize: 13, fontWeight: 500, color: 'var(--text-primary)', overflow: 'hidden', textOverflow: 'ellipsis', whiteSpace: 'nowrap', fontFamily: 'var(--mono)' }}>
                    {doc.filename}
                  </div>
                  <div style={{ fontSize: 11, color: 'var(--text-muted)', marginTop: 3, display: 'flex', gap: 10 }}>
                    <span>{doc.chunks} chunks</span>
                    <span>{doc.version_count} version{doc.version_count !== 1 ? 's' : ''}</span>
                    <span>{doc.uploaded_at ? formatDistanceToNow(new Date(doc.uploaded_at), { addSuffix: true }) : ''}</span>
                  </div>
                </div>
                <Button
                  size="sm" variant="danger"
                  onClick={e => { e.stopPropagation(); setDeleteTarget(doc.filename) }}
                >
                  Delete
                </Button>
              </div>
            ))
          )}
        </Card>

        {/* Right: Version panel */}
        <Card padding={0}>
          <div style={{ padding: '14px 16px', borderBottom: '1px solid var(--border)', fontSize: 13, fontWeight: 600, color: 'var(--text-secondary)' }}>
            {selectedDoc ? `Versions — ${selectedDoc}` : 'Select a document'}
          </div>
          {!selectedDoc ? (
            <div style={{ padding: '40px 20px', textAlign: 'center', color: 'var(--text-muted)', fontSize: 13 }}>
              Click a document on the left to see its version history
            </div>
          ) : versionsLoading ? (
            <div style={{ padding: 32, display: 'flex', justifyContent: 'center' }}><Spinner /></div>
          ) : versions.length === 0 ? (
            <EmptyState icon="📋" title="No versions found" />
          ) : (
            <div style={{ display: 'flex', flexDirection: 'column', gap: 0 }}>
              {versions.map((v, i) => (
                <div key={v.version_id} style={{
                  padding: '12px 16px', borderBottom: '1px solid var(--border)',
                  background: v.is_current ? 'rgba(45,212,160,0.04)' : 'transparent',
                }}>
                  <div style={{ display: 'flex', alignItems: 'center', gap: 8, marginBottom: 6 }}>
                    <span style={{ fontFamily: 'var(--mono)', fontSize: 12, color: 'var(--text-primary)', fontWeight: 600 }}>
                      {v.version_id}
                    </span>
                    {v.is_current && <Badge color="green">current</Badge>}
                    {i === 0 && !v.is_current && <Badge color="amber">latest upload</Badge>}
                  </div>
                  <div style={{ display: 'grid', gridTemplateColumns: '1fr 1fr', gap: 4, marginBottom: 8 }}>
                    <VersionDetail label="Chunks" value={v.chunks} />
                    <VersionDetail label="Size" value={formatBytes(v.size_bytes)} />
                    <VersionDetail label="Uploaded" value={v.uploaded_at ? format(new Date(v.uploaded_at), 'dd MMM yyyy') : '—'} />
                    <VersionDetail label="Time" value={v.uploaded_at ? format(new Date(v.uploaded_at), 'HH:mm:ss') : '—'} />
                  </div>
                  {!v.is_current && (
                    <Button
                      size="sm" variant="warn" style={{ width: '100%' }}
                      onClick={() => setRollbackTarget({ filename: selectedDoc, version_id: v.version_id })}
                    >
                      ↩ Rollback to this version
                    </Button>
                  )}
                </div>
              ))}
            </div>
          )}
        </Card>
      </div>

      {/* Delete confirm */}
      <ConfirmModal
        open={!!deleteTarget}
        onClose={() => setDeleteTarget(null)}
        onConfirm={handleDelete}
        loading={deleting}
        title="Permanently Delete Document"
        message={`Delete all versions and vectors for "${deleteTarget}"? This removes the data from Pinecone permanently and cannot be undone.`}
        confirmLabel="Delete All Versions"
        variant="danger"
      />

      {/* Rollback confirm */}
      <ConfirmModal
        open={!!rollbackTarget}
        onClose={() => setRollbackTarget(null)}
        onConfirm={handleRollback}
        loading={rollingBack}
        title="Rollback Document"
        message={`Rollback "${rollbackTarget?.filename}" to version ${rollbackTarget?.version_id}? The current active version will be deactivated.`}
        confirmLabel="Rollback"
        variant="warn"
      />
    </div>
  )
}

function VersionDetail({ label, value }) {
  return (
    <div>
      <div style={{ fontSize: 10, color: 'var(--text-muted)', letterSpacing: '0.06em', textTransform: 'uppercase' }}>{label}</div>
      <div style={{ fontSize: 12, color: 'var(--text-secondary)', fontFamily: 'var(--mono)' }}>{value}</div>
    </div>
  )
}

function formatBytes(bytes) {
  if (!bytes) return '—'
  if (bytes < 1024) return `${bytes} B`
  if (bytes < 1024 * 1024) return `${(bytes / 1024).toFixed(1)} KB`
  return `${(bytes / (1024 * 1024)).toFixed(1)} MB`
}
