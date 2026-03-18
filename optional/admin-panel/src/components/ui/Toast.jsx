import React, { createContext, useContext, useState, useCallback } from 'react'

const ToastContext = createContext(null)

export function ToastProvider({ children }) {
  const [toasts, setToasts] = useState([])

  const addToast = useCallback((message, type = 'info') => {
    const id = Date.now() + Math.random()
    setToasts(prev => [...prev, { id, message, type }])
    setTimeout(() => {
      setToasts(prev => prev.filter(t => t.id !== id))
    }, 3500)
  }, [])

  const toast = {
    success: (msg) => addToast(msg, 'success'),
    error:   (msg) => addToast(msg, 'error'),
    warn:    (msg) => addToast(msg, 'warn'),
    info:    (msg) => addToast(msg, 'info'),
  }

  return (
    <ToastContext.Provider value={toast}>
      {children}
      <ToastContainer toasts={toasts} />
    </ToastContext.Provider>
  )
}

export const useToast = () => useContext(ToastContext)

function ToastContainer({ toasts }) {
  if (!toasts.length) return null
  return (
    <div style={{
      position: 'fixed', bottom: 24, right: 24,
      display: 'flex', flexDirection: 'column', gap: 8, zIndex: 9999,
    }}>
      {toasts.map(t => (
        <div key={t.id} className="animate-slide" style={{
          padding: '10px 16px', borderRadius: 8, fontSize: 13,
          fontFamily: 'var(--sans)', fontWeight: 500,
          background: t.type === 'success' ? 'var(--green-dim)'
                    : t.type === 'error'   ? 'var(--red-dim)'
                    : t.type === 'warn'    ? 'var(--amber-dim)'
                    : 'var(--blue-dim)',
          border: `1px solid ${
            t.type === 'success' ? 'var(--green)'
          : t.type === 'error'   ? 'var(--red)'
          : t.type === 'warn'    ? 'var(--amber)'
          : 'var(--blue)'}`,
          color: t.type === 'success' ? 'var(--green)'
               : t.type === 'error'   ? 'var(--red)'
               : t.type === 'warn'    ? 'var(--amber)'
               : 'var(--blue)',
          boxShadow: 'var(--shadow)',
          maxWidth: 360,
        }}>
          {t.message}
        </div>
      ))}
    </div>
  )
}
