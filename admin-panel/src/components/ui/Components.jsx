import React from 'react'

// ── Button ────────────────────────────────────────────
export function Button({ children, variant = 'default', size = 'md', disabled, loading, onClick, style, icon }) {
  const base = {
    display: 'inline-flex', alignItems: 'center', justifyContent: 'center',
    gap: 6, border: 'none', borderRadius: 'var(--radius-sm)', fontFamily: 'var(--sans)',
    fontWeight: 500, cursor: disabled || loading ? 'not-allowed' : 'pointer',
    opacity: disabled || loading ? 0.5 : 1, transition: 'all 0.18s ease',
    whiteSpace: 'nowrap',
  }
  const sizes = {
    sm: { padding: '5px 12px', fontSize: 12 },
    md: { padding: '8px 16px', fontSize: 13 },
    lg: { padding: '11px 22px', fontSize: 14 },
  }
  const variants = {
    default: { background: 'var(--bg-hover)', color: 'var(--text-primary)', border: '1px solid var(--border-md)' },
    primary: { background: 'var(--blue-dim)', color: 'var(--blue)', border: '1px solid rgba(79,142,247,0.35)' },
    danger:  { background: 'var(--red-dim)',  color: 'var(--red)',  border: '1px solid rgba(240,82,82,0.35)' },
    success: { background: 'var(--green-dim)',color: 'var(--green)',border: '1px solid rgba(45,212,160,0.35)' },
    ghost:   { background: 'transparent',     color: 'var(--text-secondary)', border: '1px solid transparent' },
    warn:    { background: 'var(--amber-dim)',color: 'var(--amber)',border: '1px solid rgba(245,166,35,0.35)' },
  }
  return (
    <button
      onClick={!disabled && !loading ? onClick : undefined}
      style={{ ...base, ...sizes[size], ...variants[variant], ...style }}
    >
      {loading ? <Spinner size={12} /> : icon}
      {children}
    </button>
  )
}

// ── Badge ─────────────────────────────────────────────
export function Badge({ children, color = 'blue' }) {
  const colors = {
    blue:   { bg: 'var(--blue-dim)',   text: 'var(--blue)',   border: 'rgba(79,142,247,0.3)' },
    green:  { bg: 'var(--green-dim)',  text: 'var(--green)',  border: 'rgba(45,212,160,0.3)' },
    red:    { bg: 'var(--red-dim)',    text: 'var(--red)',    border: 'rgba(240,82,82,0.3)' },
    amber:  { bg: 'var(--amber-dim)',  text: 'var(--amber)',  border: 'rgba(245,166,35,0.3)' },
    purple: { bg: 'var(--purple-dim)', text: 'var(--purple)', border: 'rgba(167,139,250,0.3)' },
    gray:   { bg: 'var(--bg-hover)',   text: 'var(--text-secondary)', border: 'var(--border-md)' },
  }
  const c = colors[color] || colors.gray
  return (
    <span style={{
      display: 'inline-flex', alignItems: 'center',
      padding: '2px 8px', borderRadius: 20, fontSize: 11, fontWeight: 600,
      letterSpacing: '0.04em', background: c.bg, color: c.text,
      border: `1px solid ${c.border}`,
    }}>
      {children}
    </span>
  )
}

// ── Card ──────────────────────────────────────────────
export function Card({ children, style, padding = 20 }) {
  return (
    <div style={{
      background: 'var(--bg-surface)', border: '1px solid var(--border)',
      borderRadius: 'var(--radius-lg)', padding, ...style,
    }}>
      {children}
    </div>
  )
}

// ── Spinner ───────────────────────────────────────────
export function Spinner({ size = 18, color = 'var(--blue)' }) {
  return (
    <svg
      className="animate-spin"
      width={size} height={size} viewBox="0 0 24 24"
      fill="none" style={{ flexShrink: 0 }}
    >
      <circle cx="12" cy="12" r="10" stroke={color} strokeWidth="2.5" strokeOpacity="0.2" />
      <path d="M12 2a10 10 0 0 1 10 10" stroke={color} strokeWidth="2.5" strokeLinecap="round" />
    </svg>
  )
}

// ── Modal ─────────────────────────────────────────────
export function Modal({ open, onClose, title, children, width = 520 }) {
  if (!open) return null
  return (
    <div
      onClick={onClose}
      style={{
        position: 'fixed', inset: 0, background: 'rgba(0,0,0,0.7)',
        display: 'flex', alignItems: 'center', justifyContent: 'center',
        zIndex: 1000, backdropFilter: 'blur(4px)',
      }}
    >
      <div
        onClick={e => e.stopPropagation()}
        className="animate-slide"
        style={{
          background: 'var(--bg-surface)', border: '1px solid var(--border-md)',
          borderRadius: 'var(--radius-lg)', padding: 28, width, maxWidth: 'calc(100vw - 32px)',
          maxHeight: '85vh', overflow: 'auto', boxShadow: 'var(--shadow)',
        }}
      >
        <div style={{ display: 'flex', alignItems: 'center', justifyContent: 'space-between', marginBottom: 20 }}>
          <h3 style={{ fontSize: 16, fontWeight: 700, color: 'var(--text-primary)' }}>{title}</h3>
          <button onClick={onClose} style={{
            background: 'none', border: 'none', color: 'var(--text-muted)',
            fontSize: 20, cursor: 'pointer', lineHeight: 1, padding: 4,
          }}>×</button>
        </div>
        {children}
      </div>
    </div>
  )
}

// ── Confirm Modal ─────────────────────────────────────
export function ConfirmModal({ open, onClose, onConfirm, title, message, confirmLabel = 'Confirm', variant = 'danger', loading }) {
  return (
    <Modal open={open} onClose={onClose} title={title} width={400}>
      <p style={{ color: 'var(--text-secondary)', fontSize: 13, lineHeight: 1.6, marginBottom: 24 }}>{message}</p>
      <div style={{ display: 'flex', gap: 10, justifyContent: 'flex-end' }}>
        <Button onClick={onClose} variant="ghost">Cancel</Button>
        <Button onClick={onConfirm} variant={variant} loading={loading}>{confirmLabel}</Button>
      </div>
    </Modal>
  )
}

// ── Table ─────────────────────────────────────────────
export function Table({ columns, data, onRow, emptyText = 'No data' }) {
  return (
    <div style={{ overflowX: 'auto' }}>
      <table style={{ width: '100%', borderCollapse: 'collapse' }}>
        <thead>
          <tr>
            {columns.map(col => (
              <th key={col.key} style={{
                padding: '10px 14px', textAlign: 'left', fontSize: 11,
                fontWeight: 600, color: 'var(--text-muted)', letterSpacing: '0.08em',
                textTransform: 'uppercase', borderBottom: '1px solid var(--border)',
                whiteSpace: 'nowrap',
              }}>
                {col.label}
              </th>
            ))}
          </tr>
        </thead>
        <tbody>
          {!data || data.length === 0 ? (
            <tr>
              <td colSpan={columns.length} style={{
                padding: '32px 14px', textAlign: 'center',
                color: 'var(--text-muted)', fontSize: 13,
              }}>
                {emptyText}
              </td>
            </tr>
          ) : data.map((row, i) => (
            <tr
              key={i}
              onClick={onRow ? () => onRow(row) : undefined}
              style={{
                borderBottom: '1px solid var(--border)',
                cursor: onRow ? 'pointer' : 'default',
                transition: 'background 0.15s',
              }}
              onMouseEnter={e => { if (onRow) e.currentTarget.style.background = 'var(--bg-hover)' }}
              onMouseLeave={e => { e.currentTarget.style.background = 'transparent' }}
            >
              {columns.map(col => (
                <td key={col.key} style={{
                  padding: '11px 14px', fontSize: 13,
                  color: 'var(--text-primary)', ...col.style,
                }}>
                  {col.render ? col.render(row[col.key], row) : row[col.key]}
                </td>
              ))}
            </tr>
          ))}
        </tbody>
      </table>
    </div>
  )
}

// ── EmptyState ────────────────────────────────────────
export function EmptyState({ icon, title, description, action }) {
  return (
    <div style={{
      display: 'flex', flexDirection: 'column', alignItems: 'center',
      justifyContent: 'center', padding: '60px 20px', gap: 12, textAlign: 'center',
    }}>
      <div style={{ fontSize: 40, opacity: 0.4 }}>{icon}</div>
      <div style={{ fontSize: 15, fontWeight: 600, color: 'var(--text-secondary)' }}>{title}</div>
      {description && <div style={{ fontSize: 13, color: 'var(--text-muted)', maxWidth: 320, lineHeight: 1.6 }}>{description}</div>}
      {action}
    </div>
  )
}

// ── StatCard ──────────────────────────────────────────
export function StatCard({ label, value, sub, color = 'var(--blue)', icon }) {
  return (
    <div style={{
      background: 'var(--bg-surface)', border: '1px solid var(--border)',
      borderRadius: 'var(--radius-lg)', padding: '18px 20px',
      display: 'flex', flexDirection: 'column', gap: 6,
    }}>
      <div style={{ display: 'flex', alignItems: 'center', justifyContent: 'space-between' }}>
        <span style={{ fontSize: 11, fontWeight: 600, color: 'var(--text-muted)', letterSpacing: '0.1em', textTransform: 'uppercase' }}>{label}</span>
        {icon && <span style={{ color: 'var(--text-muted)', opacity: 0.6 }}>{icon}</span>}
      </div>
      <div style={{ fontSize: 28, fontWeight: 800, color, fontFamily: 'var(--sans)', lineHeight: 1 }}>{value}</div>
      {sub && <div style={{ fontSize: 11, color: 'var(--text-muted)' }}>{sub}</div>}
    </div>
  )
}

// ── SectionHeader ─────────────────────────────────────
export function SectionHeader({ title, description, actions }) {
  return (
    <div style={{ display: 'flex', alignItems: 'flex-start', justifyContent: 'space-between', marginBottom: 24, gap: 16 }}>
      <div>
        <h2 style={{ fontSize: 20, fontWeight: 700, color: 'var(--text-primary)', marginBottom: 4 }}>{title}</h2>
        {description && <p style={{ fontSize: 13, color: 'var(--text-secondary)', lineHeight: 1.5 }}>{description}</p>}
      </div>
      {actions && <div style={{ display: 'flex', gap: 8, flexShrink: 0 }}>{actions}</div>}
    </div>
  )
}

// ── Input ─────────────────────────────────────────────
export function Input({ value, onChange, placeholder, type = 'text', style, label }) {
  return (
    <div style={{ display: 'flex', flexDirection: 'column', gap: 6 }}>
      {label && <label style={{ fontSize: 12, color: 'var(--text-secondary)', fontWeight: 500 }}>{label}</label>}
      <input
        type={type}
        value={value}
        onChange={e => onChange(e.target.value)}
        placeholder={placeholder}
        style={{
          background: 'var(--bg-raised)', border: '1px solid var(--border-md)',
          borderRadius: 'var(--radius-sm)', padding: '9px 12px',
          color: 'var(--text-primary)', fontSize: 13, outline: 'none',
          transition: 'border-color 0.2s', width: '100%', ...style,
        }}
        onFocus={e => e.target.style.borderColor = 'var(--blue)'}
        onBlur={e => e.target.style.borderColor = 'var(--border-md)'}
      />
    </div>
  )
}

// ── StatusDot ─────────────────────────────────────────
export function StatusDot({ status }) {
  const colors = { ok: 'var(--green)', error: 'var(--red)', degraded: 'var(--amber)', unknown: 'var(--text-muted)' }
  const color = colors[status] || colors.unknown
  return (
    <span style={{
      display: 'inline-block', width: 8, height: 8,
      borderRadius: '50%', background: color,
      boxShadow: status === 'ok' ? `0 0 6px ${color}` : 'none',
    }} />
  )
}

// ── ProgressBar ───────────────────────────────────────
export function ProgressBar({ value, color = 'var(--blue)' }) {
  return (
    <div style={{
      height: 4, background: 'var(--bg-hover)', borderRadius: 4, overflow: 'hidden',
    }}>
      <div style={{
        height: '100%', width: `${Math.min(100, value)}%`,
        background: color, borderRadius: 4, transition: 'width 0.3s ease',
      }} />
    </div>
  )
}
