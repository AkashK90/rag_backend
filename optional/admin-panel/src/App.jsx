import React, { useState } from 'react'
import { Routes, Route } from 'react-router-dom'
import Sidebar from './components/layout/Sidebar'
import Topbar  from './components/layout/Topbar'
import Dashboard    from './components/pages/Dashboard'
import KnowledgeBase from './components/pages/KnowledgeBase'
import Documents    from './components/pages/Documents'
import Sessions     from './components/pages/Sessions'
import Logs         from './components/pages/Logs'
import Cache        from './components/pages/Cache'
import { ToastProvider } from './components/ui/Toast'

export default function App() {
  const [health, setHealth] = useState(null)

  return (
    <ToastProvider>
      <div style={{ display: 'flex', flexDirection: 'column', height: '100vh', overflow: 'hidden' }}>
        <Topbar onHealthUpdate={setHealth} />
        <div style={{ display: 'flex', flex: 1, overflow: 'hidden' }}>
          <Sidebar health={health} />
          <main style={{ flex: 1, overflowY: 'auto', background: 'var(--bg-base)' }}>
            <Routes>
              <Route path="/"          element={<Dashboard />} />
              <Route path="/knowledge" element={<KnowledgeBase />} />
              <Route path="/documents" element={<Documents />} />
              <Route path="/sessions"  element={<Sessions />} />
              <Route path="/logs"      element={<Logs />} />
              <Route path="/cache"     element={<Cache />} />
            </Routes>
          </main>
        </div>
      </div>
    </ToastProvider>
  )
}
