import React, { useEffect, useState, useRef } from 'react'
import { Button, Badge, Card, Spinner, EmptyState, SectionHeader } from '../ui/Components'
import { fetchAppLogs, fetchConversations } from '../../services/api'
import { useToast } from '../ui/Toast'
import { format } from 'date-fns'

const LOG_LEVEL_COLOR = {
  INFO:    'var(--blue)',
  WARNING: 'var(--amber)',
  ERROR:   'var(--red)',
  DEBUG:   'var(--text-muted)',
  SUCCESS: 'var(--green)',
}

function parseLogLevel(line) {
  if (line.includes('| ERROR |'))   return 'ERROR'
  if (line.includes('| WARNING |')) return 'WARNING'
  if (line.includes('| DEBUG |'))   return 'DEBUG'
  if (line.includes('| SUCCESS |')) return 'SUCCESS'
  return 'INFO'
}

export default function Logs() {
  const toast = useToast()
  const [activeTab,   setActiveTab]   = useState('app')
  const [appLogs,     setAppLogs]     = useState([])
  const [convLogs,    setConvLogs]    = useState([])
  const [loading,     setLoading]     = useState(false)
  const [filter,      setFilter]      = useState('')
  const [levelFilter, setLevelFilter] = useState('ALL')
  const [autoRefresh, setAutoRefresh] = useState(false)
  const intervalRef = useRef()
  const bottomRef   = useRef()

  const loadAppLogs = async () => {
    setLoading(true)
    try { setAppLogs((await fetchAppLogs(300)).logs || []) }
    catch (e) { toast.error(e.message) }
    finally { setLoading(false) }
  }

  const loadConvLogs = async () => {
    setLoading(true)
    try { setConvLogs((await fetchConversations(300)).conversations || []) }
    catch (e) { toast.error(e.message) }
    finally { setLoading(false) }
  }

  useEffect(() => {
    if (activeTab === 'app') loadAppLogs()
    else loadConvLogs()
  }, [activeTab])

  useEffect(() => {
    clearInterval(intervalRef.current)
    if (autoRefresh) {
      intervalRef.current = setInterval(() => {
        if (activeTab === 'app') loadAppLogs()
        else loadConvLogs()
      }, 5000)
    }
    return () => clearInterval(intervalRef.current)
  }, [autoRefresh, activeTab])

  const filteredApp = appLogs.filter(line => {
    const matchText  = !filter || line.toLowerCase().includes(filter.toLowerCase())
    const matchLevel = levelFilter === 'ALL' || line.includes(`| ${levelFilter} |`)
    return matchText && matchLevel
  })

  const filteredConv = convLogs.filter(c =>
    !filter ||
    c.question?.toLowerCase().includes(filter.toLowerCase()) ||
    c.answer?.toLowerCase().includes(filter.toLowerCase()) ||
    c.session_id?.toLowerCase().includes(filter.toLowerCase())
  )

  return (
    <div className="animate-fade" style={{ padding: 28, display: 'flex', flexDirection: 'column', gap: 20 }}>
      <SectionHeader
        title="System Logs"
        description="Monitor application events, errors, and full conversation history"
        actions={
          <div style={{ display: 'flex', gap: 8, alignItems: 'center' }}>
            <label style={{ display: 'flex', gap: 6, alignItems: 'center', fontSize: 12, color: 'var(--text-secondary)', cursor: 'pointer' }}>
              <input type="checkbox" checked={autoRefresh} onChange={e => setAutoRefresh(e.target.checked)} />
              Auto-refresh (5s)
            </label>
            <Button
              variant="ghost" size="sm"
              onClick={() => activeTab === 'app' ? loadAppLogs() : loadConvLogs()}
              icon="↻"
            >
              Refresh
            </Button>
          </div>
        }
      />

      {/* Tabs */}
      <div style={{ display: 'flex', gap: 0, borderBottom: '1px solid var(--border)' }}>
        {[
          { key: 'app',  label: 'Application Logs', count: appLogs.length },
          { key: 'conv', label: 'Conversation Logs', count: convLogs.length },
        ].map(tab => (
          <button
            key={tab.key}
            onClick={() => setActiveTab(tab.key)}
            style={{
              padding: '10px 20px', background: 'none', border: 'none',
              borderBottom: `2px solid ${activeTab === tab.key ? 'var(--blue)' : 'transparent'}`,
              color: activeTab === tab.key ? 'var(--blue)' : 'var(--text-secondary)',
              fontSize: 13, fontWeight: 500, cursor: 'pointer', transition: 'all 0.2s',
              display: 'flex', gap: 8, alignItems: 'center',
            }}
          >
            {tab.label}
            <Badge color={activeTab === tab.key ? 'blue' : 'gray'}>{tab.count}</Badge>
          </button>
        ))}
      </div>

      {/* Filters */}
      <div style={{ display: 'flex', gap: 10, alignItems: 'center' }}>
        <input
          placeholder={`Search ${activeTab === 'app' ? 'logs' : 'conversations'}…`}
          value={filter}
          onChange={e => setFilter(e.target.value)}
          style={{
            flex: 1, maxWidth: 360, background: 'var(--bg-raised)', border: '1px solid var(--border-md)',
            borderRadius: 6, padding: '7px 12px', fontSize: 12, color: 'var(--text-primary)',
            outline: 'none', fontFamily: 'var(--sans)',
          }}
        />
        {activeTab === 'app' && (
          <div style={{ display: 'flex', gap: 4 }}>
            {['ALL', 'INFO', 'WARNING', 'ERROR'].map(level => (
              <button
                key={level}
                onClick={() => setLevelFilter(level)}
                style={{
                  padding: '5px 10px', borderRadius: 6, fontSize: 11, fontWeight: 600,
                  border: '1px solid var(--border-md)', cursor: 'pointer', transition: 'all 0.15s',
                  background: levelFilter === level ? LOG_LEVEL_COLOR[level] || 'var(--blue)' : 'var(--bg-raised)',
                  color: levelFilter === level ? '#fff' : 'var(--text-secondary)',
                  opacity: levelFilter === level ? 1 : 0.7,
                }}
              >
                {level}
              </button>
            ))}
          </div>
        )}
        <span style={{ fontSize: 11, color: 'var(--text-muted)', marginLeft: 'auto' }}>
          {activeTab === 'app' ? filteredApp.length : filteredConv.length} entries
        </span>
      </div>

      {/* Log output */}
      {loading ? (
        <div style={{ padding: 48, display: 'flex', justifyContent: 'center' }}><Spinner /></div>
      ) : activeTab === 'app' ? (
        <AppLogView lines={filteredApp} />
      ) : (
        <ConvLogView records={filteredConv} />
      )}
    </div>
  )
}

function AppLogView({ lines }) {
  if (!lines.length) return <EmptyState icon="📋" title="No logs" description="Logs appear as the backend processes requests." />
  return (
    <div style={{
      background: 'var(--bg-base)', border: '1px solid var(--border)',
      borderRadius: 'var(--radius)', padding: 16,
      fontFamily: 'var(--mono)', fontSize: 11, lineHeight: 1.7,
      maxHeight: 560, overflowY: 'auto',
    }}>
      {lines.map((line, i) => {
        const level = parseLogLevel(line)
        const color = LOG_LEVEL_COLOR[level] || 'var(--text-secondary)'
        return (
          <div key={i} style={{ color, borderBottom: '1px solid var(--border)', padding: '3px 0' }}>
            {line}
          </div>
        )
      })}
    </div>
  )
}

function ConvLogView({ records }) {
  if (!records.length) return <EmptyState icon="💬" title="No conversations logged" description="Conversation records appear after users interact with the chatbot." />
  return (
    <div style={{ display: 'flex', flexDirection: 'column', gap: 10 }}>
      {records.map((c, i) => (
        <Card key={i} padding={16}>
          {/* Header row */}
          <div style={{ display: 'flex', gap: 10, alignItems: 'center', marginBottom: 10 }}>
            <span style={{ fontFamily: 'var(--mono)', fontSize: 11, color: 'var(--text-muted)' }}>{c.session_id}</span>
            <span style={{ fontSize: 11, color: 'var(--text-muted)', marginLeft: 'auto' }}>
              {c.timestamp ? format(new Date(c.timestamp), 'dd MMM yyyy HH:mm:ss') : '—'}
            </span>
            <span style={{ fontFamily: 'var(--mono)', fontSize: 11, color: 'var(--blue)' }}>{c.response_time_ms}ms</span>
            {c.cache_hit && <Badge color="green">cache</Badge>}
          </div>
          {/* Q&A */}
          <div style={{ marginBottom: 8 }}>
            <div style={{ fontSize: 11, color: 'var(--text-muted)', textTransform: 'uppercase', letterSpacing: '0.08em', marginBottom: 4 }}>Question</div>
            <div style={{ fontSize: 13, color: 'var(--text-primary)', lineHeight: 1.5 }}>{c.question}</div>
          </div>
          <div style={{ marginBottom: c.sources?.length ? 8 : 0 }}>
            <div style={{ fontSize: 11, color: 'var(--text-muted)', textTransform: 'uppercase', letterSpacing: '0.08em', marginBottom: 4 }}>Answer</div>
            <div style={{ fontSize: 13, color: 'var(--text-secondary)', lineHeight: 1.5 }}>
              {c.answer?.length > 200 ? c.answer.slice(0, 200) + '…' : c.answer}
            </div>
          </div>
          {c.sources?.length > 0 && (
            <div style={{ display: 'flex', gap: 4, flexWrap: 'wrap', marginTop: 8 }}>
              {c.sources.map((s, j) => <Badge key={j} color="blue">{s}</Badge>)}
            </div>
          )}
        </Card>
      ))}
    </div>
  )
}
