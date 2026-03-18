import { useState, useEffect } from 'react'

export function useSettings() {
  const [baseUrl,  setBaseUrlState]  = useState(() => localStorage.getItem('rag_base_url')  || 'http://localhost:8000')
  const [adminKey, setAdminKeyState] = useState(() => localStorage.getItem('rag_admin_key') || '')

  const setBaseUrl = (v) => {
    localStorage.setItem('rag_base_url', v)
    setBaseUrlState(v)
  }
  const setAdminKey = (v) => {
    localStorage.setItem('rag_admin_key', v)
    setAdminKeyState(v)
  }

  return { baseUrl, setBaseUrl, adminKey, setAdminKey }
}
