import React, { useState } from 'react'
import { Input, Button, Spinner } from '../ui/Components'
import { useSettings } from '../../hooks/useSettings'
import { fetchHealth } from '../../services/api'

export default function Topbar({ onHealthUpdate }) {
  const { baseUrl, setBaseUrl, adminKey, setAdminKey } = useSettings()
  const [connecting, setConnecting] = useState(false)
  const [connected, setConnected]   = useState(false)

  const handleConnect = async () => {
    setConnecting(true)
    setConnected(false)
    try {
      const h = await fetchHealth()
      onHealthUpdate(h)
      setConnected(true)
    } catch {
      onHealthUpdate(null)
      setConnected(false)
    } finally {
      setConnecting(false)
    }
  }

  return (
    <header style={{
      height: 56, background: 'var(--bg-surface)',
      borderBottom: '1px solid var(--border)',
      display: 'flex', alignItems: 'center', gap: 12, padding: '0 20px',
      flexShrink: 0,
    }}>
      {/* Base URL */}
      <div style={{ display: 'flex', alignItems: 'center', gap: 8, flex: 1, maxWidth: 360 }}>
        <span style={{ fontSize: 11, color: 'var(--text-muted)', whiteSpace: 'nowrap', fontFamily: 'var(--mono)' }}>BASE URL</span>
        <input
          value={baseUrl}
          onChange={e => setBaseUrl(e.target.value)}
          placeholder="http://localhost:8000"
          style={{
            flex: 1, background: 'var(--bg-raised)', border: '1px solid var(--border-md)',
            borderRadius: 6, padding: '5px 10px', color: 'var(--text-primary)',
            fontSize: 12, fontFamily: 'var(--mono)', outline: 'none',
          }}
        />
      </div>

      {/* Admin Key */}
      <div style={{ display: 'flex', alignItems: 'center', gap: 8, flex: 1, maxWidth: 300 }}>
        <span style={{ fontSize: 11, color: 'var(--text-muted)', whiteSpace: 'nowrap', fontFamily: 'var(--mono)' }}>ADMIN KEY</span>
        <input
          type="password"
          value={adminKey}
          onChange={e => setAdminKey(e.target.value)}
          placeholder= "asd345lkj876g6oq" //"X-Admin-API-Key"
          style={{
            flex: 1, background: 'var(--bg-raised)', border: '1px solid var(--border-md)',
            borderRadius: 6, padding: '5px 10px', color: 'var(--text-primary)',
            fontSize: 12, fontFamily: 'var(--mono)', outline: 'none',
          }}
        />
      </div>

      <Button
        variant="primary"
        size="sm"
        onClick={handleConnect}
        loading={connecting}
        icon={connected ? '✓' : null}
      >
        {connected ? 'Connected' : 'Connect'}
      </Button>
    </header>
  )
}
