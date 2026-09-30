import { useCallback, useEffect, useRef, useState } from 'react'
import { getSupabaseClient } from '../../lib/supabase'
import { DashboardAccessError, loadDashboard, type DashboardSnapshot } from './dashboard-data'
import { requestSourceSync, waitForSourceSync } from './sync-request'

export function useDashboard() {
  const [snapshot, setSnapshot] = useState<DashboardSnapshot | null>(null)
  const [error, setError] = useState<string | null>(null)
  const [refreshing, setRefreshing] = useState(false)
  const [updatedAt, setUpdatedAt] = useState<Date | null>(null)
  const [now, setNow] = useState(() => new Date())
  const [syncing, setSyncing] = useState(false)
  const request = useRef<AbortController | null>(null)
  const sync = useRef<AbortController | null>(null)

  const refresh = useCallback(async () => {
    if (request.current) return
    const client = getSupabaseClient()
    if (!client) { setError('A conexão do painel não está configurada.'); return }
    const controller = new AbortController()
    request.current = controller
    setRefreshing(true)
    try {
      const data = await loadDashboard(client, controller.signal)
      if (!controller.signal.aborted) {
        setSnapshot(data); setError(null); setUpdatedAt(new Date()); setNow(new Date())
      }
    } catch (cause) {
      if (!controller.signal.aborted) {
        if (cause instanceof DashboardAccessError) { setSnapshot(null); setUpdatedAt(null) }
        setError(cause instanceof Error ? cause.message : 'Falha de conexão. Tente atualizar novamente.')
      }
    } finally {
      if (request.current === controller) request.current = null
      if (!controller.signal.aborted) setRefreshing(false)
    }
  }, [])

  // Dispatches a fresh collection from every source, waits for it, then reloads the dashboard.
  const syncNow = useCallback(async () => {
    if (sync.current) return
    const client = getSupabaseClient()
    if (!client) { setError('A conexão do painel não está configurada.'); return }
    const controller = new AbortController()
    sync.current = controller
    setSyncing(true)
    let syncError: string | null = null
    try {
      const requestedAt = await requestSourceSync(client, controller.signal)
      await waitForSourceSync(client, requestedAt, controller.signal)
    } catch (cause) {
      syncError = cause instanceof Error ? cause.message : 'Não foi possível solicitar uma nova coleta.'
    }
    if (controller.signal.aborted) return
    await refresh()
    if (syncError) setError(syncError)
    sync.current = null
    setSyncing(false)
  }, [refresh])

  useEffect(() => {
    const initial = window.setTimeout(() => { void refresh() }, 0)
    const interval = window.setInterval(() => { if (!document.hidden) void refresh() }, 5 * 60000)
    const clock = window.setInterval(() => setNow(new Date()), 60000)
    const resume = () => { if (!document.hidden) void refresh() }
    window.addEventListener('online', resume)
    document.addEventListener('visibilitychange', resume)
    return () => {
      window.clearInterval(interval); window.clearInterval(clock)
      window.clearTimeout(initial)
      window.removeEventListener('online', resume); document.removeEventListener('visibilitychange', resume)
      request.current?.abort(); request.current = null
      sync.current?.abort(); sync.current = null
    }
  }, [refresh])

  return { snapshot, error, refreshing, syncing, updatedAt, now, refresh, syncNow }
}
