import React, { useEffect, useState, useRef } from 'react'
import {
  Button, Badge, Card, Spinner, Modal, ConfirmModal,
  Table, EmptyState, SectionHeader, ProgressBar,
} from '../ui/Components'
import {
  fetchDocuments, uploadDocument, deleteDocument,
  fetchDocumentVersions, rollbackDocument,
} from '../../services/api'
import { useToast } from '../ui/Toast'
import { formatDistanceToNow, format } from 'date-fns'

export default function KnowledgeBase() {
  const toast = useToast()
  const [docs,        setDocs]        = useState([])
  const [loading,     setLoading]     = useState(true)
  const [uploading,   setUploading]   = useState(false)
  const [progress,    setProgress]    = useState(0)
  const [dragOver,    setDragOver]    = useState(false)
  const [deleteTarget, setDeleteTarget] = useState(null)
  const [deleting,    setDeleting]    = useState(false)
  const [versionModal, setVersionModal] = useState(null) // filename
  const [versions,    setVersions]    = useState([])
  const [versionsLoading, setVersionsLoading] = useState(false)
  const [rollbackTarget, setRollbackTarget] = useState(null) // {filename, version_id}
  const [rollingBack, setRollingBack] = useState(false)
  const fileInputRef = useRef()

  const load = async () => {
    setLoading(true)
    try {
      const data = await fetchDocuments()
      setDocs(data)
    } catch (e) {
      toast.error(`Failed to load documents: ${e.message}`)
    } finally {
      setLoading(false)
    }
  }

  useEffect(() => { load() }, [])

  const handleFiles = async (files) => {
    const allowed = ['application/pdf', 'text/plain']
    const valid = [...files].filter(f => allowed.includes(f.type))
    if (!valid.length) { toast.warn('Only PDF and TXT files are supported.'); return }
    setUploading(true)
    for (const file of valid) {
      setProgress(0)
      try {
        const res = await uploadDocument(file, setProgress)
        toast.success(`✓ ${file.name} — ${res.chunks_ingested} chunks ingested`)
      } catch (e) {
        toast.error(`✗ ${file.name}: ${e.message}`)
      }
    }
    setUploading(false)
    setProgress(0)
    load()
  }

  const handleDelete = async () => {
    if (!deleteTarget) return
    setDeleting(true)
    try {
      const res = await deleteDocument(deleteTarget)
      toast.success(`Deleted ${deleteTarget} (${res.vectors_deleted} vectors removed)`)
      setDeleteTarget(null)
      load()
    } catch (e) {
      toast.error(`Delete failed: ${e.message}`)
    } finally {
      setDeleting(false)
    }
  }

  const openVersions = async (filename) => {
    setVersionModal(filename)
    setVersionsLoading(true)
    try {
      const v = await fetchDocumentVersions(filename)
      setVersions(v)
    } catch (e) {
      toast.error(`Could not load versions: ${e.message}`)
    } finally {
      setVersionsLoading(false)
    }
  }

  const handleRollback = async () => {
    if (!rollbackTarget) return
    setRollingBack(true)
    try {
      const res = await rollbackDocument(rollbackTarget.filename, rollbackTarget.version_id)
      toast.success(`Rolled back to ${rollbackTarget.version_id} — ${res.chunks_restored} chunks restored`)
      setRollbackTarget(null)
      setVersionModal(null)
      load()
    } catch (e) {
      toast.error(`Rollback failed: ${e.message}`)
    } finally {
      setRollingBack(false)
    }
  }

  const totalChunks = docs.reduce((a, d) => a + d.chunks, 0)

  return (
    <div className="animate-fade" style={{ padding: 28, display: 'flex', flexDirection: 'column', gap: 24 }}>
      <SectionHeader
        title="Knowledge Base"
        description="Upload, manage, and version-control your RAG knowledge sources"
        actions={
          <Button variant="primary" onClick={() => fileInputRef.current?.click()} icon="↑" disabled={uploading}>
            Upload Document
          </Button>
        }
      />
      <input ref={fileInputRef} type="file" multiple accept=".pdf,.txt" style={{ display: 'none' }}
        onChange={e => handleFiles(e.target.files)} />

      {/* Stats row */}
      <div style={{ display: 'grid', gridTemplateColumns: 'repeat(3, 1fr)', gap: 12 }}>
        <MiniStat label="Documents" value={docs.length} />
        <MiniStat label="Total Chunks" value={totalChunks} />
        <MiniStat label="Avg Chunks/Doc" value={docs.length ? Math.round(totalChunks / docs.length) : 0} />
      </div>

      {/* Drop zone */}
      <div
        onDragOver={e => { e.preventDefault(); setDragOver(true) }}
        onDragLeave={() => setDragOver(false)}
        onDrop={e => { e.preventDefault(); setDragOver(false); handleFiles(e.dataTransfer.files) }}
        onClick={() => !uploading && fileInputRef.current?.click()}
        style={{
          border: `2px dashed ${dragOver ? 'var(--blue)' : 'var(--border-md)'}`,
          borderRadius: 'var(--radius-lg)', padding: '28px 20px',
          textAlign: 'center', cursor: uploading ? 'wait' : 'pointer',
          background: dragOver ? 'var(--blue-dim)' : 'var(--bg-surface)',
          transition: 'all 0.2s',
        }}
      >
        {uploading ? (
          <div style={{ display: 'flex', flexDirection: 'column', alignItems: 'center', gap: 12 }}>
            <Spinner size={24} />
            <div style={{ fontSize: 13, color: 'var(--text-secondary)' }}>Uploading & ingesting…</div>
            <div style={{ width: 200 }}>
              <ProgressBar value={progress} />
              <div style={{ fontSize: 11, color: 'var(--text-muted)', marginTop: 4, textAlign: 'center' }}>{progress}%</div>
            </div>
          </div>
        ) : (
          <>
            <div style={{ fontSize: 32, marginBottom: 8, opacity: 0.5 }}>📄</div>
            <div style={{ fontSize: 14, fontWeight: 600, color: 'var(--text-secondary)', marginBottom: 4 }}>
              Drop PDF or TXT files here
            </div>
            <div style={{ fontSize: 12, color: 'var(--text-muted)' }}>
              or click to browse — max {50}MB per file
            </div>
          </>
        )}
      </div>

      {/* Document table */}
      <Card padding={0}>
        <div style={{ padding: '14px 18px', borderBottom: '1px solid var(--border)', display: 'flex', alignItems: 'center', justifyContent: 'space-between' }}>
          <span style={{ fontSize: 13, fontWeight: 600, color: 'var(--text-secondary)' }}>Ingested Documents</span>
          <Button variant="ghost" size="sm" onClick={load} icon="↻">Refresh</Button>
        </div>
        {loading ? (
          <div style={{ padding: 40, display: 'flex', justifyContent: 'center' }}><Spinner /></div>
        ) : docs.length === 0 ? (
          <EmptyState
            icon="📭"
            title="No documents ingested"
            description="Upload PDF or TXT files above to build your knowledge base."
          />
        ) : (
          <Table
            columns={[
              { key: 'filename',           label: 'Filename',        render: (v) => <span style={{ fontFamily: 'var(--mono)', fontSize: 12 }}>{v}</span> },
              { key: 'chunks',             label: 'Chunks',          render: (v) => <Badge color="blue">{v}</Badge> },
              { key: 'version_count',      label: 'Versions',        render: (v) => <Badge color="purple">{v}</Badge> },
              { key: 'current_version_id', label: 'Current Ver.',    render: (v) => <span style={{ fontFamily: 'var(--mono)', fontSize: 11, color: 'var(--text-muted)' }}>{v}</span> },
              { key: 'uploaded_at',        label: 'Last Uploaded',   render: (v) => v ? <span style={{ fontSize: 12, color: 'var(--text-muted)' }}>{formatDistanceToNow(new Date(v), { addSuffix: true })}</span> : '—' },
              {
                key: '_actions', label: 'Actions',
                render: (_, row) => (
                  <div style={{ display: 'flex', gap: 6 }}>
                    <Button size="sm" variant="ghost" onClick={() => openVersions(row.filename)}>Versions</Button>
                    <Button size="sm" variant="danger" onClick={() => setDeleteTarget(row.filename)}>Delete</Button>
                  </div>
                )
              },
            ]}
            data={docs}
          />
        )}
      </Card>

      {/* Delete confirm */}
      <ConfirmModal
        open={!!deleteTarget}
        onClose={() => setDeleteTarget(null)}
        onConfirm={handleDelete}
        loading={deleting}
        title="Delete Document"
        message={`This will permanently remove all versions and vectors for "${deleteTarget}" from Pinecone. This action cannot be undone.`}
        confirmLabel="Delete Permanently"
        variant="danger"
      />

      {/* Version history modal */}
      <Modal
        open={!!versionModal}
        onClose={() => setVersionModal(null)}
        title={`Version History — ${versionModal}`}
        width={620}
      >
        {versionsLoading ? (
          <div style={{ padding: 32, display: 'flex', justifyContent: 'center' }}><Spinner /></div>
        ) : (
          <div style={{ display: 'flex', flexDirection: 'column', gap: 10 }}>
            <p style={{ fontSize: 12, color: 'var(--text-muted)', marginBottom: 6 }}>
              Each upload creates a new version. Rolling back restores that version's vectors in Pinecone.
            </p>
            {versions.map((v) => (
              <div key={v.version_id} style={{
                padding: '12px 14px', borderRadius: 'var(--radius)',
                border: `1px solid ${v.is_current ? 'rgba(45,212,160,0.35)' : 'var(--border)'}`,
                background: v.is_current ? 'var(--green-dim)' : 'var(--bg-raised)',
                display: 'flex', alignItems: 'center', gap: 12,
              }}>
                <div style={{ flex: 1 }}>
                  <div style={{ display: 'flex', gap: 8, alignItems: 'center', marginBottom: 4 }}>
                    <span style={{ fontFamily: 'var(--mono)', fontSize: 12, color: 'var(--text-primary)' }}>{v.version_id}</span>
                    {v.is_current && <Badge color="green">current</Badge>}
                  </div>
                  <div style={{ fontSize: 11, color: 'var(--text-muted)', display: 'flex', gap: 16 }}>
                    <span>{v.chunks} chunks</span>
                    <span>{formatBytes(v.size_bytes)}</span>
                    <span>{v.uploaded_at ? format(new Date(v.uploaded_at), 'dd MMM yyyy HH:mm') : '—'}</span>
                  </div>
                </div>
                {!v.is_current && (
                  <Button
                    size="sm"
                    variant="warn"
                    onClick={() => setRollbackTarget({ filename: versionModal, version_id: v.version_id })}
                  >
                    Rollback
                  </Button>
                )}
              </div>
            ))}
          </div>
        )}
      </Modal>

      {/* Rollback confirm */}
      <ConfirmModal
        open={!!rollbackTarget}
        onClose={() => setRollbackTarget(null)}
        onConfirm={handleRollback}
        loading={rollingBack}
        title="Rollback Version"
        message={`Roll back "${rollbackTarget?.filename}" to version ${rollbackTarget?.version_id}? The current version will be deactivated.`}
        confirmLabel="Rollback"
        variant="warn"
      />
    </div>
  )
}

function MiniStat({ label, value }) {
  return (
    <div style={{
      background: 'var(--bg-surface)', border: '1px solid var(--border)',
      borderRadius: 'var(--radius)', padding: '12px 16px',
    }}>
      <div style={{ fontSize: 11, color: 'var(--text-muted)', textTransform: 'uppercase', letterSpacing: '0.08em', marginBottom: 4 }}>{label}</div>
      <div style={{ fontSize: 22, fontWeight: 700, color: 'var(--text-primary)', fontFamily: 'var(--sans)' }}>{value}</div>
    </div>
  )
}

function formatBytes(bytes) {
  if (!bytes) return '—'
  if (bytes < 1024) return `${bytes} B`
  if (bytes < 1024 * 1024) return `${(bytes / 1024).toFixed(1)} KB`
  return `${(bytes / (1024 * 1024)).toFixed(1)} MB`
}
