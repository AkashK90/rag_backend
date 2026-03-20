import React, { useEffect, useState } from 'react'
import { Button, Card, Badge, Spinner, StatCard, ConfirmModal, SectionHeader } from '../ui/Components'
import { fetchCacheStats, clearCache } from '../../services/api'
import { useToast } from '../ui/Toast'

export default function Cache() {
  const toast = useToast()
  const [stats,     setStats]     = useState(null)
  const [loading,   setLoading]   = useState(true)
  const [confirm,   setConfirm]   = useState(false)
  const [clearing,  setClearing]  = useState(false)

  const load = async () => {
    setLoading(true)
    try { setStats(await fetchCacheStats()) }
    catch (e) { toast.error(e.message) }
    finally { setLoading(false) }
  }

  useEffect(() => { load() }, [])

  const handleClear = async () => {
    setClearing(true)
    try {
      const res = await clearCache()
      toast.success(res.message || 'Cache cleared')
      setConfirm(false)
      load()
    } catch (e) {
      toast.error(e.message)
    } finally {
      setClearing(false)
    }
  }

  return (
    <div className="animate-fade" style={{ padding: 28, display: 'flex', flexDirection: 'column', gap: 24 }}>
      <SectionHeader
        title="Cache Management"
        description="Monitor and control the MongoDB response cache"
        actions={
          <div style={{ display: 'flex', gap: 8 }}>
            <Button variant="ghost" size="sm" onClick={load} icon="↻">Refresh</Button>
            <Button variant="danger" size="sm" onClick={() => setConfirm(true)}>Clear Cache</Button>
          </div>
        }
      />

      {loading ? (
        <div style={{ padding: 48, display: 'flex', justifyContent: 'center' }}><Spinner /></div>
      ) : stats ? (
        <>
          <div style={{ display: 'grid', gridTemplateColumns: 'repeat(2, 1fr)', gap: 16, maxWidth: 500 }}>
            <StatCard label="Cached Keys"  value={stats.total_cached_keys} color="var(--green)" />
            <StatCard label="TTL (seconds)" value={stats.ttl_seconds}      color="var(--amber)" sub="per cached answer" />
          </div>

          <Card>
            <div style={{ fontSize: 13, fontWeight: 600, color: 'var(--text-secondary)', marginBottom: 14 }}>How the Cache Works</div>
            <div style={{ display: 'flex', flexDirection: 'column', gap: 10 }}>
              <InfoRow label="Type"       value="Exact-match SHA-256 key per question (normalized)" />
              <InfoRow label="Storage"    value="MongoDB (persists across server restarts)" />
              <InfoRow label="TTL"        value={`${stats.ttl_seconds}s (${Math.round(stats.ttl_seconds / 3600)}h) — configurable in .env`} />
              <InfoRow label="Cache Miss" value="Full RAG pipeline: embed → retrieve → GPT-4 (~800–2000ms)" />
              <InfoRow label="Cache Hit"  value="Fast MongoDB lookup (disk-dependent)" />
              <InfoRow label="Key format" value="cache:exact:<sha256(normalized_question)>" mono />
            </div>
          </Card>

          <Card>
            <div style={{ fontSize: 13, fontWeight: 600, color: 'var(--text-secondary)', marginBottom: 10 }}>When to Clear Cache</div>
            <ul style={{ listStyle: 'none', display: 'flex', flexDirection: 'column', gap: 8 }}>
              {[
                'After uploading new documents (answers may now be different)',
                'After rolling back or deleting a document version',
                'After changing system prompt or model settings',
                'When debugging incorrect cached responses',
              ].map((item, i) => (
                <li key={i} style={{ fontSize: 13, color: 'var(--text-secondary)', display: 'flex', gap: 8 }}>
                  <span style={{ color: 'var(--amber)', flexShrink: 0 }}>→</span> {item}
                </li>
              ))}
            </ul>
          </Card>
        </>
      ) : (
        <div style={{ fontSize: 13, color: 'var(--text-muted)' }}>Could not load cache stats. Ensure your backend is connected.</div>
      )}

      <ConfirmModal
        open={confirm}
        onClose={() => setConfirm(false)}
        onConfirm={handleClear}
        loading={clearing}
        title="Clear All Cache"
        message={`This will delete all ${stats?.total_cached_keys || 0} cached responses from MongoDB. Users will experience slightly slower response times until the cache rebuilds. Continue?`}
        confirmLabel="Clear Cache"
        variant="danger"
      />
    </div>
  )
}

function InfoRow({ label, value, mono }) {
  return (
    <div style={{ display: 'flex', gap: 16, alignItems: 'baseline', borderBottom: '1px solid var(--border)', paddingBottom: 8 }}>
      <span style={{ fontSize: 12, color: 'var(--text-muted)', width: 130, flexShrink: 0, fontWeight: 500 }}>{label}</span>
      <span style={{
        fontSize: 12, color: 'var(--text-primary)',
        fontFamily: mono ? 'var(--mono)' : 'var(--sans)',
      }}>{value}</span>
    </div>
  )
}
