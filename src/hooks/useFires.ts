import { useCallback, useEffect, useRef, useState } from 'react'
import { fetchFires } from '../lib/api'
import { config } from '../lib/config'
import type { FiresPayload } from '../types'

export interface FiresState {
  data: FiresPayload | null
  loading: boolean
  error: string | null
  /** إعادة الجلب يدوياً */
  refresh: () => void
  /** لحظة آخر جلب ناجح (ميلي‑ثانية) */
  fetchedAt: number | null
}

/** يجلب الحرائق مرة عند الإقلاع، ثم دورياً حسب `VITE_REFRESH_MINUTES`. */
export function useFires(): FiresState {
  const [data, setData] = useState<FiresPayload | null>(null)
  const [loading, setLoading] = useState(true)
  const [error, setError] = useState<string | null>(null)
  const [fetchedAt, setFetchedAt] = useState<number | null>(null)
  const controllerRef = useRef<AbortController | null>(null)

  const load = useCallback(async () => {
    controllerRef.current?.abort()
    const controller = new AbortController()
    controllerRef.current = controller

    setLoading(true)
    try {
      const payload = await fetchFires(controller.signal)
      if (controller.signal.aborted) return
      setData(payload)
      setFetchedAt(Date.now())
      setError(null)
    } catch (err) {
      if (controller.signal.aborted) return
      setError(err instanceof Error ? err.message : 'حدث خطأ غير متوقع')
    } finally {
      if (!controller.signal.aborted) setLoading(false)
    }
  }, [])

  useEffect(() => {
    void load()
    return () => controllerRef.current?.abort()
  }, [load])

  useEffect(() => {
    if (config.refreshMinutes <= 0) return
    const id = window.setInterval(() => void load(), config.refreshMinutes * 60_000)
    return () => window.clearInterval(id)
  }, [load])

  return { data, loading, error, refresh: () => void load(), fetchedAt }
}
