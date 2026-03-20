import React from 'react'
import { NavLink, useLocation } from 'react-router-dom'

const NAV = [
  { path: '/',            label: 'Dashboard',     icon: '⬡' },
  { path: '/knowledge',   label: 'Knowledge Base', icon: '◈', separator_before: true },
  { path: '/documents',   label: 'Documents',      icon: '◧' },
  { path: '/sessions',    label: 'Sessions',        icon: '⬡', separator_before: true },
  { path: '/logs',        label: 'System Logs',     icon: '◫' },
  { path: '/cache',       label: 'Cache',           icon: '◪' },
]

export default function Sidebar({ health }) {
  return (
    <aside style={{
      width: 220, background: 'var(--bg-surface)',
      borderRight: '1px solid var(--border)',
      display: 'flex', flexDirection: 'column',
      flexShrink: 0, height: '100vh', position: 'sticky', top: 0,
    }}>
      {/* Logo */}
      <div style={{
        padding: '20px 20px 16px',
        borderBottom: '1px solid var(--border)',
      }}>
        <div style={{ fontFamily: 'var(--sans)', fontWeight: 800, fontSize: 16, color: 'var(--text-primary)', letterSpacing: '-0.02em' }}>
          RAG <span style={{ color: 'var(--blue)' }}>Admin</span>
        </div>
        <div style={{ fontSize: 11, color: 'var(--text-muted)', marginTop: 3, fontFamily: 'var(--mono)' }}>
          developer console
        </div>
      </div>

      {/* System status strip */}
      <div style={{
        padding: '10px 16px', borderBottom: '1px solid var(--border)',
        display: 'flex', gap: 12, alignItems: 'center',
      }}>
        {health ? (
          <>
            <StatusPip label="AI"  ok={health.openai  === 'ok'} />
            <StatusPip label="DB"  ok={health.pinecone === 'ok'} />
            <StatusPip label="Cache" ok={health.mongodb === 'ok'} />
          </>
        ) : (
          <span style={{ fontSize: 11, color: 'var(--text-muted)' }}>— not connected —</span>
        )}
      </div>

      {/* Nav */}
      <nav style={{ flex: 1, padding: '12px 10px', display: 'flex', flexDirection: 'column', gap: 2, overflowY: 'auto' }}>
        {NAV.map(item => (
          <React.Fragment key={item.path}>
            {item.separator_before && (
              <div style={{ height: 1, background: 'var(--border)', margin: '8px 6px' }} />
            )}
            <NavLink
              to={item.path}
              end={item.path === '/'}
              style={({ isActive }) => ({
                display: 'flex', alignItems: 'center', gap: 10,
                padding: '8px 10px', borderRadius: 'var(--radius-sm)',
                fontSize: 13, fontWeight: isActive ? 600 : 400,
                color: isActive ? 'var(--blue)' : 'var(--text-secondary)',
                background: isActive ? 'var(--blue-dim)' : 'transparent',
                border: isActive ? '1px solid rgba(79,142,247,0.2)' : '1px solid transparent',
                transition: 'all 0.15s',
                textDecoration: 'none',
              })}
            >
              <span style={{ fontSize: 15, opacity: 0.8 }}>{item.icon}</span>
              {item.label}
            </NavLink>
          </React.Fragment>
        ))}
      </nav>

      {/* Bottom: version */}
      <div style={{ padding: '12px 16px', borderTop: '1px solid var(--border)' }}>
        <div style={{ fontSize: 11, color: 'var(--text-muted)', fontFamily: 'var(--mono)' }}>v1.0.0 — optional</div>
      </div>
    </aside>
  )
}

function StatusPip({ label, ok }) {
  return (
    <div style={{ display: 'flex', alignItems: 'center', gap: 4 }}>
      <div style={{
        width: 6, height: 6, borderRadius: '50%',
        background: ok ? 'var(--green)' : 'var(--red)',
        boxShadow: ok ? '0 0 5px var(--green)' : 'none',
      }} />
      <span style={{ fontSize: 10, color: 'var(--text-muted)', letterSpacing: '0.06em' }}>{label}</span>
    </div>
  )
}
