import React, { useState } from 'react'
import { Routes, Route } from 'react-router-dom'
import Sidebar from './components/layout/Sidebar'
import Topbar  from './components/layout/Topbar'
import AdminLoginModal from './components/layout/AdminLoginModal'
import Dashboard    from './components/pages/Dashboard'
import KnowledgeBase from './components/pages/KnowledgeBase'
import Documents    from './components/pages/Documents'
import Sessions     from './components/pages/Sessions'
import Logs         from './components/pages/Logs'
import Cache        from './components/pages/Cache'
import { ToastProvider } from './components/ui/Toast'
import { useSettings } from './hooks/useSettings'

export default function App() {
  const [health, setHealth] = useState(null)
  const [authVersion, setAuthVersion] = useState(0)
  const { adminUser, adminPass } = useSettings()
  const isAuthed = Boolean(adminUser && adminPass)

  return (
    <ToastProvider>
      <div style={{ display: 'flex', flexDirection: 'column', height: '100vh', overflow: 'hidden' }}>
        <Topbar onHealthUpdate={setHealth} />
        {!isAuthed && (
          <AdminLoginModal
            onHealthUpdate={setHealth}
            onLoginSuccess={() => setAuthVersion(v => v + 1)}
          />
        )}
        {isAuthed && (
          <div style={{ display: 'flex', flex: 1, overflow: 'hidden' }}>
            <Sidebar health={health} />
            <main style={{ flex: 1, overflowY: 'auto', background: 'var(--bg-base)' }}>
              <Routes>
                <Route path="/"          element={<Dashboard key={`dash-${authVersion}`} />} />
                <Route path="/knowledge" element={<KnowledgeBase key={`kb-${authVersion}`} />} />
                <Route path="/documents" element={<Documents key={`docs-${authVersion}`} />} />
                <Route path="/sessions"  element={<Sessions key={`sess-${authVersion}`} />} />
                <Route path="/logs"      element={<Logs key={`logs-${authVersion}`} />} />
                <Route path="/cache"     element={<Cache key={`cache-${authVersion}`} />} />
              </Routes>
            </main>
          </div>
        )}
      </div>
    </ToastProvider>
  )
}
