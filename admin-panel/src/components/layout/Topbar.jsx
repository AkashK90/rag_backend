import React, { useState } from 'react'
import { Button } from '../ui/Components'
import { useSettings } from '../../hooks/useSettings'

export default function Topbar({ onHealthUpdate }) {
  const { baseUrl, setBaseUrl, adminUser, setAdminUser, adminPass, setAdminPass } = useSettings()
  const [connected, setConnected] = useState(false)

  const handleLogout = () => {
    setAdminUser('')
    setAdminPass('')
    setConnected(false)
    onHealthUpdate(null)
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

      <div style={{ display: 'flex', alignItems: 'center', gap: 8 }}>
        <span style={{ fontSize: 11, color: 'var(--text-muted)', fontFamily: 'var(--mono)' }}>
          {adminUser && adminPass ? 'ADMIN: OK' : 'LOGIN REQUIRED'}
        </span>
        {adminUser && adminPass && (
          <Button variant="ghost" size="sm" onClick={handleLogout}>
            Logout
          </Button>
        )}
      </div>
    </header>
  )
}
