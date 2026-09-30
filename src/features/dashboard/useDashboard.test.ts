import { act, renderHook } from '@testing-library/react'
import { vi } from 'vitest'
import { DashboardAccessError, loadDashboard } from './dashboard-data'
import { getSupabaseClient } from '../../lib/supabase'
import { useDashboard } from './useDashboard'
import { requestSourceSync, waitForSourceSync } from './sync-request'

vi.mock('./dashboard-data', async importOriginal => ({ ...await importOriginal<typeof import('./dashboard-data')>(), loadDashboard: vi.fn() }))
vi.mock('../../lib/supabase', () => ({ getSupabaseClient: vi.fn() }))
vi.mock('./sync-request', () => ({ requestSourceSync: vi.fn(), waitForSourceSync: vi.fn() }))

afterEach(() => { vi.useRealTimers(); vi.resetAllMocks() })

it('refreshes after five minutes, preserves the last successful snapshot on failure, and stops on unmount', async () => {
  vi.useFakeTimers()
  vi.mocked(getSupabaseClient).mockReturnValue({} as NonNullable<ReturnType<typeof getSupabaseClient>>)
  const snapshot = { facts: [], sources: [{ id: '1', code: 'ordersync', name: 'OrdemSync', status: 'healthy', last_success_at: '2026-09-29T12:00:00Z' }] }
  vi.mocked(loadDashboard).mockResolvedValueOnce(snapshot).mockRejectedValueOnce(new Error('Conexão interrompida'))
  const { result, unmount } = renderHook(() => useDashboard())
  await act(async () => { await vi.advanceTimersByTimeAsync(0) })
  expect(result.current.snapshot).toEqual(snapshot)
  await act(async () => { await vi.advanceTimersByTimeAsync(5 * 60000) })
  expect(result.current.error).toBe('Conexão interrompida')
  expect(result.current.snapshot).toEqual(snapshot)
  expect(result.current.refreshing).toBe(false)
  unmount()
  const calls = vi.mocked(loadDashboard).mock.calls.length
  await vi.advanceTimersByTimeAsync(5 * 60000)
  expect(loadDashboard).toHaveBeenCalledTimes(calls)
})

it('clears cached business data when access is no longer authorized', async () => {
  vi.useFakeTimers()
  vi.mocked(getSupabaseClient).mockReturnValue({} as NonNullable<ReturnType<typeof getSupabaseClient>>)
  vi.mocked(loadDashboard).mockResolvedValueOnce({ facts: [], sources: [] }).mockRejectedValueOnce(new DashboardAccessError('Acesso não autorizado'))
  const { result, unmount } = renderHook(() => useDashboard())
  await act(async () => { await vi.advanceTimersByTimeAsync(0) })
  expect(result.current.snapshot).not.toBeNull()
  await act(async () => { await result.current.refresh() })
  expect(result.current.snapshot).toBeNull()
  expect(result.current.updatedAt).toBeNull()
  expect(result.current.error).toBe('Acesso não autorizado')
  unmount()
})

it('asks the sources for a new collection before reloading when the user syncs now', async () => {
  vi.useFakeTimers()
  vi.mocked(getSupabaseClient).mockReturnValue({} as NonNullable<ReturnType<typeof getSupabaseClient>>)
  const before = { facts: [], sources: [] }
  const after = { facts: [{ external_id: 'x', entity_kind: 'individual' as const, display_name: null, plan: null, status: 'active', period_end_at: null, trial_end_at: null, seat_count: null, provider: null }], sources: [] }
  vi.mocked(loadDashboard).mockResolvedValueOnce(before).mockResolvedValueOnce(after)
  vi.mocked(requestSourceSync).mockResolvedValue('2026-09-30T01:00:00Z')
  vi.mocked(waitForSourceSync).mockResolvedValue(true)
  const { result, unmount } = renderHook(() => useDashboard())
  await act(async () => { await vi.advanceTimersByTimeAsync(0) })

  await act(async () => { await result.current.syncNow() })

  expect(requestSourceSync).toHaveBeenCalledOnce()
  expect(waitForSourceSync).toHaveBeenCalledWith(expect.anything(), '2026-09-30T01:00:00Z', expect.any(AbortSignal))
  expect(result.current.snapshot).toEqual(after)
  expect(result.current.syncing).toBe(false)
  unmount()
})

it('still reloads and reports the problem when a collection cannot be requested', async () => {
  vi.useFakeTimers()
  vi.mocked(getSupabaseClient).mockReturnValue({} as NonNullable<ReturnType<typeof getSupabaseClient>>)
  vi.mocked(loadDashboard).mockResolvedValue({ facts: [], sources: [] })
  vi.mocked(requestSourceSync).mockRejectedValue(new Error('Não foi possível solicitar'))
  const { result, unmount } = renderHook(() => useDashboard())
  await act(async () => { await vi.advanceTimersByTimeAsync(0) })

  await act(async () => { await result.current.syncNow() })

  expect(loadDashboard).toHaveBeenCalledTimes(2)
  expect(result.current.error).toBe('Não foi possível solicitar')
  unmount()
})
