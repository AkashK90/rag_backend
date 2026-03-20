import React, { useState } from 'react'
import { Button } from '../ui/Components'
import { useSettings } from '../../hooks/useSettings'
import { pingAdmin } from '../../services/api'

export default function AdminLoginModal({ onHealthUpdate, onLoginSuccess }) {
  const { setAdminUser, setAdminPass } = useSettings()
  const [username, setUsername] = useState('')
  const [password, setPassword] = useState('')
  const [loading, setLoading] = useState(false)
  const [error, setError] = useState('')

  const handleLogin = async () => {
    setLoading(true)
    setError('')
    try {
      setAdminUser(username)
      setAdminPass(password)
      const h = await pingAdmin()
      onHealthUpdate(h)
      if (onLoginSuccess) onLoginSuccess()
    } catch (e) {
      setAdminUser('')
      setAdminPass('')
      setError(e.message || 'Login failed')
      onHealthUpdate(null)
    } finally {
      setLoading(false)
    }
  }

  return (
    <div style={{
      position: 'fixed', inset: 0, zIndex: 9999,
      background: 'rgba(10,12,20,0.35)', backdropFilter: 'blur(6px)',
      display: 'flex', alignItems: 'center', justifyContent: 'center',
    }}>
      <div style={{
        width: 360, background: 'var(--bg-surface)', border: '1px solid var(--border)',
        borderRadius: 12, padding: 20, boxShadow: 'var(--shadow)',
      }}>
        <div style={{ fontSize: 14, fontWeight: 700, color: 'var(--text-primary)', marginBottom: 6 }}>
          Admin Login
        </div>
        <div style={{ fontSize: 12, color: 'var(--text-muted)', marginBottom: 16 }}>
          Enter your user ID and password to access the admin panel.
        </div>

        <div style={{ display: 'flex', flexDirection: 'column', gap: 10, marginBottom: 14 }}>
          <input
            value={username}
            onChange={e => setUsername(e.target.value)}
            placeholder="User ID"
            style={{
              background: 'var(--bg-raised)', border: '1px solid var(--border-md)',
              borderRadius: 8, padding: '8px 10px', color: 'var(--text-primary)',
              fontSize: 12, outline: 'none',
            }}
          />
          <input
            type="password"
            value={password}
            onChange={e => setPassword(e.target.value)}
            placeholder="Password"
            style={{
              background: 'var(--bg-raised)', border: '1px solid var(--border-md)',
              borderRadius: 8, padding: '8px 10px', color: 'var(--text-primary)',
              fontSize: 12, outline: 'none',
            }}
          />
        </div>

        {error && (
          <div style={{ fontSize: 12, color: 'var(--red)', marginBottom: 10 }}>
            {error}
          </div>
        )}

        <Button variant="primary" size="sm" onClick={handleLogin} loading={loading}>
          Login
        </Button>
      </div>
    </div>
  )
}
