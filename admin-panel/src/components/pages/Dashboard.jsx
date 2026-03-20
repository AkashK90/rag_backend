import React, { useEffect, useState } from 'react'
import { StatCard, Card, Badge, Spinner, StatusDot, SectionHeader, Button } from '../ui/Components'
import { fetchHealth, fetchDocuments, fetchConversations, fetchCacheStats, fetchSessions, sendChat } from '../../services/api'
import { AreaChart, Area, XAxis, YAxis, Tooltip, ResponsiveContainer, LineChart, Line, BarChart, Bar } from 'recharts'
import { formatDistanceToNow } from 'date-fns'

export default function Dashboard() {
  const [health,    setHealth]    = useState(null)
  const [docs,      setDocs]      = useState([])
  const [convs,     setConvs]     = useState([])
  const [cache,     setCache]     = useState(null)
  const [sessions,  setSessions]  = useState([])
  const [loading,   setLoading]   = useState(true)
  const [error,     setError]     = useState(null)
  const [chatMessages, setChatMessages] = useState([])
  const [chatInput, setChatInput] = useState('')
  const [chatSessionId, setChatSessionId] = useState('')
  const [chatSending, setChatSending] = useState(false)

  useEffect(() => {
    const load = async () => {
      setLoading(true)
      try {
        const [h, d, c, cs, s] = await Promise.allSettled([
          fetchHealth(), fetchDocuments(), fetchConversations(500),
          fetchCacheStats(), fetchSessions(),
        ])
        if (h.status === 'fulfilled') setHealth(h.value)
        if (d.status === 'fulfilled') setDocs(d.value)
        if (c.status === 'fulfilled') setConvs(c.value.conversations || [])
        if (cs.status === 'fulfilled') setCache(cs.value)
        if (s.status === 'fulfilled') setSessions(s.value)
      } catch (e) {
        setError(e.message)
      } finally {
        setLoading(false)
      }
    }
    load()
  }, [])

  // Build chart data: questions per hour for last 24h
  const chartData = buildHourlyChart(convs)
  const latencyData = buildLatencyChart(convs)
  const cacheData = buildCacheChart(convs)
  const cacheHits = convs.filter(c => c.cache_hit).length
  const cacheRate = convs.length ? Math.round((cacheHits / convs.length) * 100) : 0
  const avgMs     = convs.length ? Math.round(convs.reduce((a, c) => a + (c.response_time_ms || 0), 0) / convs.length) : 0
  const errors    = 0 // future: track from app logs

  if (loading) return <LoadingPane />

  const handleSendChat = async () => {
    const question = chatInput.trim()
    if (!question || chatSending) return
    setChatSending(true)
    setChatInput('')
    const localSession = chatSessionId || undefined
    setChatMessages(prev => [...prev, { role: 'human', content: question }])
    try {
      const res = await sendChat(question, localSession)
      setChatSessionId(res.session_id)
      setChatMessages(prev => [...prev, { role: 'ai', content: res.answer, sources: res.sources }])
    } catch (e) {
      setChatMessages(prev => [...prev, { role: 'ai', content: `Error: ${e.message}` }])
    } finally {
      setChatSending(false)
    }
  }

  const handleNewSession = () => {
    setChatSessionId('')
    setChatMessages([])
  }

  return (
    <div className="animate-fade" style={{ padding: 28, display: 'flex', flexDirection: 'column', gap: 28 }}>
      <SectionHeader
        title="Dashboard"
        description="System overview and real-time metrics"
      />

      {/* System health row */}
      <div>
        <div style={{ fontSize: 12, fontWeight: 600, color: 'var(--text-muted)', letterSpacing: '0.1em', textTransform: 'uppercase', marginBottom: 12 }}>
          System Health
        </div>
        <div style={{ display: 'grid', gridTemplateColumns: 'repeat(3, 1fr)', gap: 12 }}>
          <HealthCard label="OpenAI GPT-4"  status={health?.openai}   detail="LLM Generation" />
          <HealthCard label="Pinecone"      status={health?.pinecone} detail="Vector Store" />
          <HealthCard label="MongoDB"       status={health?.mongodb}  detail="Cache + Memory" />
        </div>
      </div>

      {/* Stats row */}
      <div style={{ display: 'grid', gridTemplateColumns: 'repeat(4, 1fr)', gap: 12 }}>
        <StatCard label="Documents"     value={docs.length}      color="var(--blue)"   sub={`${docs.reduce((a,d)=>a+d.chunks,0)} total chunks`} />
        <StatCard label="Conversations" value={convs.length}     color="var(--purple)" sub="all time" />
        <StatCard label="Cache Rate"    value={`${cacheRate}%`}  color="var(--green)"  sub={`${cacheHits} hits`} />
        <StatCard label="Avg Response"  value={avgMs ? `${avgMs}ms` : '—'} color="var(--amber)" sub="response time" />
      </div>

      {/* Chart + recent convs */}
      <div style={{ display: 'grid', gridTemplateColumns: '1fr 380px', gap: 20 }}>
        <Card>
          <div style={{ fontSize: 13, fontWeight: 600, color: 'var(--text-secondary)', marginBottom: 16 }}>Questions / Hour (last 24h)</div>
          {chartData.length > 0 ? (
            <ResponsiveContainer width="100%" height={180}>
              <AreaChart data={chartData}>
                <defs>
                  <linearGradient id="grad" x1="0" y1="0" x2="0" y2="1">
                    <stop offset="5%"  stopColor="var(--blue)" stopOpacity={0.25} />
                    <stop offset="95%" stopColor="var(--blue)" stopOpacity={0} />
                  </linearGradient>
                </defs>
                <XAxis dataKey="hour" tick={{ fontSize: 11, fill: 'var(--text-muted)' }} axisLine={false} tickLine={false} />
                <YAxis tick={{ fontSize: 11, fill: 'var(--text-muted)' }} axisLine={false} tickLine={false} allowDecimals={false} />
                <Tooltip
                  contentStyle={{ background: 'var(--bg-raised)', border: '1px solid var(--border-md)', borderRadius: 8, fontSize: 12 }}
                  labelStyle={{ color: 'var(--text-secondary)' }}
                  itemStyle={{ color: 'var(--blue)' }}
                />
                <Area type="monotone" dataKey="count" stroke="var(--blue)" strokeWidth={2} fill="url(#grad)" />
              </AreaChart>
            </ResponsiveContainer>
          ) : (
            <div style={{ height: 180, display: 'flex', alignItems: 'center', justifyContent: 'center', color: 'var(--text-muted)', fontSize: 13 }}>
              No conversation data yet
            </div>
          )}
        </Card>

        {/* Recent activity */}
        <Card padding={0}>
          <div style={{ padding: '16px 18px', borderBottom: '1px solid var(--border)', fontSize: 13, fontWeight: 600, color: 'var(--text-secondary)' }}>
            Recent Conversations
          </div>
          <div style={{ overflowY: 'auto', maxHeight: 260 }}>
            {convs.slice(0, 8).map((c, i) => (
              <div key={i} style={{
                padding: '10px 18px', borderBottom: '1px solid var(--border)',
                display: 'flex', flexDirection: 'column', gap: 4,
              }}>
                <div style={{ fontSize: 12, color: 'var(--text-primary)', overflow: 'hidden', textOverflow: 'ellipsis', whiteSpace: 'nowrap' }}>
                  {c.question}
                </div>
                <div style={{ display: 'flex', gap: 8, alignItems: 'center' }}>
                  <span style={{ fontSize: 11, color: 'var(--text-muted)', fontFamily: 'var(--mono)' }}>{c.response_time_ms}ms</span>
                  {c.cache_hit && <Badge color="green">cache</Badge>}
                  <span style={{ fontSize: 11, color: 'var(--text-muted)', marginLeft: 'auto' }}>
                    {c.timestamp ? formatDistanceToNow(new Date(c.timestamp), { addSuffix: true }) : ''}
                  </span>
                </div>
              </div>
            ))}
            {convs.length === 0 && (
              <div style={{ padding: 24, textAlign: 'center', color: 'var(--text-muted)', fontSize: 13 }}>No conversations yet</div>
            )}
          </div>
        </Card>
      </div>

      {/* Secondary charts */}
      <div style={{ display: 'grid', gridTemplateColumns: '1fr 1fr', gap: 20 }}>
        <Card>
          <div style={{ fontSize: 13, fontWeight: 600, color: 'var(--text-secondary)', marginBottom: 16 }}>Avg Response Time / Hour (last 24h)</div>
          {latencyData.length > 0 ? (
            <ResponsiveContainer width="100%" height={180}>
              <LineChart data={latencyData}>
                <XAxis dataKey="hour" tick={{ fontSize: 11, fill: 'var(--text-muted)' }} axisLine={false} tickLine={false} />
                <YAxis tick={{ fontSize: 11, fill: 'var(--text-muted)' }} axisLine={false} tickLine={false} />
                <Tooltip
                  contentStyle={{ background: 'var(--bg-raised)', border: '1px solid var(--border-md)', borderRadius: 8, fontSize: 12 }}
                  labelStyle={{ color: 'var(--text-secondary)' }}
                  itemStyle={{ color: 'var(--amber)' }}
                />
                <Line type="monotone" dataKey="avg_ms" stroke="var(--amber)" strokeWidth={2} dot={false} />
              </LineChart>
            </ResponsiveContainer>
          ) : (
            <div style={{ height: 180, display: 'flex', alignItems: 'center', justifyContent: 'center', color: 'var(--text-muted)', fontSize: 13 }}>
              No latency data yet
            </div>
          )}
        </Card>

        <Card>
          <div style={{ fontSize: 13, fontWeight: 600, color: 'var(--text-secondary)', marginBottom: 16 }}>Cache Hit Rate / Hour (last 24h)</div>
          {cacheData.length > 0 ? (
            <ResponsiveContainer width="100%" height={180}>
              <BarChart data={cacheData}>
                <XAxis dataKey="hour" tick={{ fontSize: 11, fill: 'var(--text-muted)' }} axisLine={false} tickLine={false} />
                <YAxis tick={{ fontSize: 11, fill: 'var(--text-muted)' }} axisLine={false} tickLine={false} />
                <Tooltip
                  contentStyle={{ background: 'var(--bg-raised)', border: '1px solid var(--border-md)', borderRadius: 8, fontSize: 12 }}
                  labelStyle={{ color: 'var(--text-secondary)' }}
                  itemStyle={{ color: 'var(--green)' }}
                />
                <Bar dataKey="hit_rate" fill="var(--green)" radius={[4, 4, 0, 0]} />
              </BarChart>
            </ResponsiveContainer>
          ) : (
            <div style={{ height: 180, display: 'flex', alignItems: 'center', justifyContent: 'center', color: 'var(--text-muted)', fontSize: 13 }}>
              No cache data yet
            </div>
          )}
        </Card>
      </div>

      {/* Active sessions */}
      <Card>
        <div style={{ fontSize: 13, fontWeight: 600, color: 'var(--text-secondary)', marginBottom: 14 }}>
          Active Sessions ({sessions.length})
        </div>
        <div style={{ display: 'flex', flexWrap: 'wrap', gap: 8 }}>
          {sessions.slice(0, 20).map((sid, i) => (
            <Badge key={i} color="gray">{sid}</Badge>
          ))}
          {sessions.length === 0 && <span style={{ fontSize: 12, color: 'var(--text-muted)' }}>No active sessions</span>}
          {sessions.length > 20 && <Badge color="blue">+{sessions.length - 20} more</Badge>}
        </div>
      </Card>

      {/* Dev Chat Tester */}
      <Card>
        <div style={{ display: 'flex', alignItems: 'center', gap: 10, marginBottom: 12 }}>
          <div style={{ fontSize: 13, fontWeight: 600, color: 'var(--text-secondary)' }}>Developer Chat Test</div>
          <span style={{ fontSize: 11, color: 'var(--text-muted)', fontFamily: 'var(--mono)' }}>
            Session: {chatSessionId || 'new'}
          </span>
          <div style={{ marginLeft: 'auto' }}>
            <Button variant="ghost" size="sm" onClick={handleNewSession}>New Session</Button>
          </div>
        </div>
        <div style={{
          height: 220, overflowY: 'auto', border: '1px solid var(--border)',
          borderRadius: 8, padding: 12, background: 'var(--bg-base)', marginBottom: 12,
        }}>
          {chatMessages.length === 0 ? (
            <div style={{ fontSize: 12, color: 'var(--text-muted)' }}>
              Type a question to test the chatbot. This uses the public `/api/chat` endpoint.
            </div>
          ) : (
            <div style={{ display: 'flex', flexDirection: 'column', gap: 10 }}>
              {chatMessages.map((m, i) => (
                <div key={i} style={{
                  alignSelf: m.role === 'human' ? 'flex-end' : 'flex-start',
                  maxWidth: '80%',
                  background: m.role === 'human' ? 'var(--blue)' : 'var(--bg-raised)',
                  color: m.role === 'human' ? '#fff' : 'var(--text-primary)',
                  padding: '8px 10px',
                  borderRadius: 8,
                  fontSize: 12,
                  lineHeight: 1.4,
                }}>
                  {m.content}
                </div>
              ))}
            </div>
          )}
        </div>
        <div style={{ display: 'flex', gap: 8 }}>
          <input
            value={chatInput}
            onChange={e => setChatInput(e.target.value)}
            placeholder="Ask a test question..."
            onKeyDown={e => e.key === 'Enter' && handleSendChat()}
            style={{
              flex: 1, background: 'var(--bg-raised)', border: '1px solid var(--border-md)',
              borderRadius: 6, padding: '7px 10px', color: 'var(--text-primary)',
              fontSize: 12, outline: 'none',
            }}
          />
          <Button variant="primary" size="sm" onClick={handleSendChat} loading={chatSending}>
            Send
          </Button>
        </div>
      </Card>
    </div>
  )
}

function HealthCard({ label, status, detail }) {
  const ok = status === 'ok'
  return (
    <div style={{
      background: 'var(--bg-surface)', border: `1px solid ${ok ? 'rgba(45,212,160,0.2)' : 'rgba(240,82,82,0.2)'}`,
      borderRadius: 'var(--radius)', padding: '14px 16px',
      display: 'flex', alignItems: 'center', gap: 12,
    }}>
      <StatusDot status={ok ? 'ok' : 'error'} />
      <div>
        <div style={{ fontSize: 13, fontWeight: 600, color: 'var(--text-primary)' }}>{label}</div>
        <div style={{ fontSize: 11, color: 'var(--text-muted)', marginTop: 2 }}>
          {ok ? detail : (status || 'unreachable')}
        </div>
      </div>
      <div style={{ marginLeft: 'auto' }}>
        <Badge color={ok ? 'green' : 'red'}>{ok ? 'healthy' : 'error'}</Badge>
      </div>
    </div>
  )
}

function LoadingPane() {
  return (
    <div style={{ flex: 1, display: 'flex', alignItems: 'center', justifyContent: 'center', gap: 12, color: 'var(--text-muted)', fontSize: 13 }}>
      <Spinner /> Loading dashboard…
    </div>
  )
}

function buildHourlyChart(convs) {
  const now = new Date()
  const hours = Array.from({ length: 24 }, (_, i) => {
    const h = new Date(now)
    h.setHours(now.getHours() - 23 + i, 0, 0, 0)
    return { hour: `${h.getHours()}:00`, count: 0, _h: h.getHours(), _d: h.getDate() }
  })
  convs.forEach(c => {
    if (!c.timestamp) return
    const d = new Date(c.timestamp)
    const diff = (now - d) / 3600000
    if (diff <= 24) {
      const idx = hours.findIndex(h => h._h === d.getHours() && h._d === d.getDate())
      if (idx >= 0) hours[idx].count++
    }
  })
  return hours
}

function buildLatencyChart(convs) {
  const now = new Date()
  const hours = Array.from({ length: 24 }, (_, i) => {
    const h = new Date(now)
    h.setHours(now.getHours() - 23 + i, 0, 0, 0)
    return { hour: `${h.getHours()}:00`, sum: 0, count: 0, avg_ms: 0, _h: h.getHours(), _d: h.getDate() }
  })
  convs.forEach(c => {
    if (!c.timestamp) return
    const d = new Date(c.timestamp)
    const diff = (now - d) / 3600000
    if (diff <= 24) {
      const idx = hours.findIndex(h => h._h === d.getHours() && h._d === d.getDate())
      if (idx >= 0) {
        hours[idx].sum += c.response_time_ms || 0
        hours[idx].count += 1
      }
    }
  })
  return hours.map(h => ({ hour: h.hour, avg_ms: h.count ? Math.round(h.sum / h.count) : 0 }))
}

function buildCacheChart(convs) {
  const now = new Date()
  const hours = Array.from({ length: 24 }, (_, i) => {
    const h = new Date(now)
    h.setHours(now.getHours() - 23 + i, 0, 0, 0)
    return { hour: `${h.getHours()}:00`, hits: 0, total: 0, hit_rate: 0, _h: h.getHours(), _d: h.getDate() }
  })
  convs.forEach(c => {
    if (!c.timestamp) return
    const d = new Date(c.timestamp)
    const diff = (now - d) / 3600000
    if (diff <= 24) {
      const idx = hours.findIndex(h => h._h === d.getHours() && h._d === d.getDate())
      if (idx >= 0) {
        hours[idx].total += 1
        if (c.cache_hit) hours[idx].hits += 1
      }
    }
  })
  return hours.map(h => ({ hour: h.hour, hit_rate: h.total ? Math.round((h.hits / h.total) * 100) : 0 }))
}
