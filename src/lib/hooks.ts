'use client'

import { useCallback, useEffect, useRef, useState } from 'react'
import { api, ApiClientError } from './api-client'

export interface ApiState<T> {
  data: T | null
  error: ApiClientError | null
  loading: boolean
  reload: () => Promise<void>
}

/** Small data hook: fetch, error, loading, manual + optional auto refresh. */
export function useApi<T>(path: string | null, opts: { refreshMs?: number } = {}): ApiState<T> {
  const [data, setData] = useState<T | null>(null)
  const [error, setError] = useState<ApiClientError | null>(null)
  const [loading, setLoading] = useState(Boolean(path))
  const mounted = useRef(true)

  const reload = useCallback(async () => {
    if (!path) return
    try {
      const result = await api<T>(path)
      if (mounted.current) {
        setData(result)
        setError(null)
      }
    } catch (err) {
      if (mounted.current) setError(err instanceof ApiClientError ? err : new ApiClientError(0, 'UNKNOWN', 'Unexpected error'))
    } finally {
      if (mounted.current) setLoading(false)
    }
  }, [path])

  useEffect(() => {
    mounted.current = true
    setLoading(Boolean(path))
    void reload()
    return () => {
      mounted.current = false
    }
  }, [reload])

  useEffect(() => {
    if (!opts.refreshMs || !path) return
    const timer = setInterval(() => {
      void reload()
    }, opts.refreshMs)
    return () => clearInterval(timer)
  }, [opts.refreshMs, path, reload])

  return { data, error, loading, reload }
}
