import React, { useEffect, useState } from 'react'
import { Button, Badge, Card, Spinner, Modal, ConfirmModal, EmptyState, SectionHeader } from '../ui/Components'
import { fetchSessions, fetchSession, deleteSession, fetchConversations } from '../../services/api'
import { useToast } from '../ui/Toast'
import { format, formatDistanceToNow } from 'date-fns'

export default function Sessions() {
  const toast = useToast()
  const [sessions,      setSessions]      = useState([])
  const [loading,       setLoading]       = useState(true)
  const [selected,      setSelected]      = useState(null)
  const [sessionDetail, setSessionDetail] = useState(null)
  const [detailLoading, setDetailLoading] = useState(false)
  const [convMap,       setConvMap]       = useState({}) // session_id -> [conv records]
  const [deleteTarget,  setDeleteTarget]  = useState(null)
  const [deleting,      setDeleting]      = useState(false)
  const [search,        setSearch]        = useState('')

  const loadAll = async () => {
    setLoading(true)
    try {
      const [sids, convs] = await Promise.all([
        fetchSessions(),
        fetchConversations(1000),
      ])
      setSessions(sids)
      // Build map: session_id -> sorted conversation records
      const map = {}
      for (const c of (convs.conversations || [])) {
        if (!map[c.session_id]) map[c.session_id] = []
        map[c.session_id].push(c)
      }
      setConvMap(map)
    } catch (e) {
      toast.error(e.message)
    } finally {
      setLoading(false)
    }
  }

  useEffect(() => { loadAll() }, [])

  const openSession = async (sid) => {
    setSelected(sid)
    setDetailLoading(true)
    try {
      const d = await fetchSession(sid)
      setSessionDetail(d)
    } catch (e) {
      toast.error(e.message)
      setSessionDetail(null)
    } finally {
      setDetailLoading(false)
    }
  }

  const handleDelete = async () => {
    setDeleting(true)
    try {
      await deleteSession(deleteTarget)
      toast.success(`Session ${deleteTarget} deleted`)
      setDeleteTarget(null)
      if (selected === deleteTarget) { setSelected(null); setSessionDetail(null) }
      loadAll()
    } catch (e) { toast.error(e.message) }
    finally { setDeleting(false) }
  }

  const filtered = sessions.filter(s => s.toLowerCase().includes(search.toLowerCase()))

  return (
    <div className="animate-fade" style={{ padding: 28, display: 'flex', flexDirection: 'column', gap: 24 }}>
      <SectionHeader
        title="Sessions & Conversations"
        description="Inspect every user session, conversation history, timestamps, and response metadata"
        actions={<Button variant="ghost" size="sm" onClick={loadAll} icon="↻">Refresh</Button>}
      />

      <div style={{ display: 'grid', gridTemplateColumns: '300px 1fr', gap: 20, alignItems: 'start', minHeight: 500 }}>

        {/* Session list */}
        <Card padding={0}>
          <div style={{ padding: '10px 14px', borderBottom: '1px solid var(--border)' }}>
            <input
              placeholder="Filter sessions…"
              value={search}
              onChange={e => setSearch(e.target.value)}
              style={{
                width: '100%', background: 'var(--bg-raised)', border: '1px solid var(--border-md)',
                borderRadius: 6, padding: '6px 10px', fontSize: 12, color: 'var(--text-primary)',
                outline: 'none', fontFamily: 'var(--sans)',
              }}
            />
          </div>
          <div style={{ padding: '8px 10px', borderBottom: '1px solid var(--border)' }}>
            <span style={{ fontSize: 11, color: 'var(--text-muted)' }}>{filtered.length} session{filtered.length !== 1 ? 's' : ''}</span>
          </div>
          {loading ? (
            <div style={{ padding: 32, display: 'flex', justifyContent: 'center' }}><Spinner /></div>
          ) : filtered.length === 0 ? (
            <EmptyState icon="💬" title="No sessions" description="Sessions appear when users start chatting." />
          ) : (
            <div style={{ maxHeight: 600, overflowY: 'auto' }}>
              {filtered.map((sid, i) => {
                const convs = convMap[sid] || []
                const last  = convs[0]
                return (
                  <div
                    key={i}
                    onClick={() => openSession(sid)}
                    style={{
                      padding: '10px 14px', borderBottom: '1px solid var(--border)',
                      cursor: 'pointer', transition: 'background 0.15s',
                      background: selected === sid ? 'var(--bg-active)' : 'transparent',
                    }}
                    onMouseEnter={e => { if (selected !== sid) e.currentTarget.style.background = 'var(--bg-hover)' }}
                    onMouseLeave={e => { if (selected !== sid) e.currentTarget.style.background = 'transparent' }}
                  >
                    <div style={{ fontSize: 12, fontFamily: 'var(--mono)', color: 'var(--text-primary)', overflow: 'hidden', textOverflow: 'ellipsis', whiteSpace: 'nowrap', marginBottom: 4 }}>
                      {sid}
                    </div>
                    <div style={{ display: 'flex', gap: 8, alignItems: 'center' }}>
                      <Badge color="blue">{convs.length} msgs</Badge>
                      {last?.timestamp && (
                        <span style={{ fontSize: 10, color: 'var(--text-muted)' }}>
                          {formatDistanceToNow(new Date(last.timestamp), { addSuffix: true })}
                        </span>
                      )}
                    </div>
                  </div>
                )
              })}
            </div>
          )}
        </Card>

        {/* Session detail */}
        <Card padding={0}>
          {!selected ? (
            <EmptyState icon="👆" title="Select a session" description="Click any session on the left to inspect its conversation history." />
          ) : (
            <>
              <div style={{ padding: '12px 16px', borderBottom: '1px solid var(--border)', display: 'flex', alignItems: 'center', justifyContent: 'space-between' }}>
                <div>
                  <span style={{ fontSize: 13, fontWeight: 600, color: 'var(--text-primary)', fontFamily: 'var(--mono)' }}>{selected}</span>
                  {sessionDetail && (
                    <Badge color="purple" style={{ marginLeft: 10 }}>{sessionDetail.total_messages} messages</Badge>
                  )}
                </div>
                <div style={{ display: 'flex', gap: 8 }}>
                  <Button size="sm" variant="ghost" onClick={() => openSession(selected)} icon="↻">Reload</Button>
                  <Button size="sm" variant="danger" onClick={() => setDeleteTarget(selected)}>Delete Session</Button>
                </div>
              </div>

              {/* Conversation log records for this session */}
              <ConvRecords convs={convMap[selected] || []} />

              {/* Chat messages from Redis */}
              <div style={{ padding: '10px 16px', borderTop: '1px solid var(--border)', background: 'var(--bg-raised)' }}>
                <div style={{ fontSize: 12, fontWeight: 600, color: 'var(--text-muted)', marginBottom: 10, textTransform: 'uppercase', letterSpacing: '0.08em' }}>
                  Redis Memory (latest {sessionDetail?.total_messages} messages)
                </div>
                {detailLoading ? (
                  <div style={{ padding: 20, display: 'flex', justifyContent: 'center' }}><Spinner /></div>
                ) : sessionDetail ? (
                  <div style={{ display: 'flex', flexDirection: 'column', gap: 8, maxHeight: 280, overflowY: 'auto' }}>
                    {sessionDetail.messages.map((msg, i) => (
                      <div key={i} style={{
                        padding: '8px 12px', borderRadius: 8, fontSize: 12, lineHeight: 1.5,
                        background: msg.role === 'human' ? 'var(--blue-dim)' : 'var(--bg-hover)',
                        border: `1px solid ${msg.role === 'human' ? 'rgba(79,142,247,0.2)' : 'var(--border)'}`,
                        alignSelf: msg.role === 'human' ? 'flex-end' : 'flex-start',
                        maxWidth: '85%',
                      }}>
                        <div style={{ fontSize: 10, color: 'var(--text-muted)', marginBottom: 3, textTransform: 'uppercase', letterSpacing: '0.06em' }}>
                          {msg.role === 'human' ? 'User' : 'Assistant'}
                        </div>
                        {msg.content}
                      </div>
                    ))}
                  </div>
                ) : (
                  <div style={{ fontSize: 12, color: 'var(--text-muted)' }}>No message data</div>
                )}
              </div>
            </>
          )}
        </Card>
      </div>

      <ConfirmModal
        open={!!deleteTarget}
        onClose={() => setDeleteTarget(null)}
        onConfirm={handleDelete}
        loading={deleting}
        title="Delete Session"
        message={`Delete session "${deleteTarget}" from Redis? This clears its conversation memory permanently.`}
        confirmLabel="Delete"
        variant="danger"
      />
    </div>
  )
}

function ConvRecords({ convs }) {
  if (!convs.length) return (
    <div style={{ padding: '14px 16px', fontSize: 12, color: 'var(--text-muted)' }}>No logged conversations for this session.</div>
  )
  return (
    <div style={{ maxHeight: 300, overflowY: 'auto' }}>
      {convs.map((c, i) => (
        <div key={i} style={{
          padding: '10px 16px', borderBottom: '1px solid var(--border)',
          display: 'grid', gridTemplateColumns: '1fr auto', gap: 10, alignItems: 'start',
        }}>
          <div>
            <div style={{ fontSize: 12, color: 'var(--text-primary)', marginBottom: 4 }}>
              <span style={{ color: 'var(--text-muted)', fontSize: 11 }}>Q: </span>{c.question}
            </div>
            <div style={{ fontSize: 12, color: 'var(--text-secondary)', marginBottom: 6 }}>
              <span style={{ color: 'var(--text-muted)', fontSize: 11 }}>A: </span>
              {c.answer?.length > 120 ? c.answer.slice(0, 120) + '…' : c.answer}
            </div>
            {c.sources?.length > 0 && (
              <div style={{ display: 'flex', gap: 4, flexWrap: 'wrap' }}>
                {c.sources.map((s, j) => <Badge key={j} color="blue">{s}</Badge>)}
              </div>
            )}
          </div>
          <div style={{ display: 'flex', flexDirection: 'column', gap: 4, alignItems: 'flex-end', flexShrink: 0 }}>
            <span style={{ fontSize: 11, color: 'var(--text-muted)', fontFamily: 'var(--mono)' }}>{c.response_time_ms}ms</span>
            {c.cache_hit && <Badge color="green">cache</Badge>}
            {c.timestamp && (
              <span style={{ fontSize: 10, color: 'var(--text-muted)' }}>
                {format(new Date(c.timestamp), 'HH:mm:ss')}
              </span>
            )}
          </div>
        </div>
      ))}
    </div>
  )
}
