import { useState, useCallback } from 'react'

/**
 * useApi — wraps any async API call with loading, error, and data state.
 * Usage:
 *   const { data, loading, error, run } = useApi(fetchDocuments)
 *   useEffect(() => { run() }, [])
 */
export function useApi(apiFn) {
  const [data,    setData]    = useState(null)
  const [loading, setLoading] = useState(false)
  const [error,   setError]   = useState(null)

  const run = useCallback(async (...args) => {
    setLoading(true)
    setError(null)
    try {
      const result = await apiFn(...args)
      setData(result)
      return result
    } catch (e) {
      setError(e.message)
      throw e
    } finally {
      setLoading(false)
    }
  }, [apiFn])

  return { data, loading, error, run, setData }
}

/**
 * useAction — for mutations (upload, delete, rollback) that show toast feedback.
 */
export function useAction() {
  const [pending, setPending] = useState(false)
  const [error,   setError]   = useState(null)

  const run = useCallback(async (apiFn, ...args) => {
    setPending(true)
    setError(null)
    try {
      return await apiFn(...args)
    } catch (e) {
      setError(e.message)
      throw e
    } finally {
      setPending(false)
    }
  }, [])

  return { pending, error, run }
}
