import { useState, useEffect } from 'react'

export function useSettings() {
  const [baseUrl,  setBaseUrlState]  = useState(() => localStorage.getItem('rag_base_url')  || 'http://localhost:8000')
  const [adminUser, setAdminUserState] = useState(() => localStorage.getItem('rag_admin_user') || '')
  const [adminPass, setAdminPassState] = useState(() => localStorage.getItem('rag_admin_pass') || '')

  useEffect(() => {
    const sync = () => {
      setBaseUrlState(localStorage.getItem('rag_base_url') || 'http://localhost:8000')
      setAdminUserState(localStorage.getItem('rag_admin_user') || '')
      setAdminPassState(localStorage.getItem('rag_admin_pass') || '')
    }
    window.addEventListener('storage', sync)
    window.addEventListener('rag-auth-change', sync)
    return () => {
      window.removeEventListener('storage', sync)
      window.removeEventListener('rag-auth-change', sync)
    }
  }, [])

  const setBaseUrl = (v) => {
    localStorage.setItem('rag_base_url', v)
    setBaseUrlState(v)
    window.dispatchEvent(new Event('rag-auth-change'))
  }
  const setAdminUser = (v) => {
    localStorage.setItem('rag_admin_user', v)
    setAdminUserState(v)
    window.dispatchEvent(new Event('rag-auth-change'))
  }
  const setAdminPass = (v) => {
    localStorage.setItem('rag_admin_pass', v)
    setAdminPassState(v)
    window.dispatchEvent(new Event('rag-auth-change'))
  }

  return { baseUrl, setBaseUrl, adminUser, setAdminUser, adminPass, setAdminPass }
}
