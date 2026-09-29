import { act, renderHook } from '@testing-library/react'
import { vi } from 'vitest'
import { DashboardAccessError, loadDashboard } from './dashboard-data'
import { getSupabaseClient } from '../../lib/supabase'
import { useDashboard } from './useDashboard'

vi.mock('./dashboard-data', async importOriginal => ({ ...await importOriginal<typeof import('./dashboard-data')>(), loadDashboard: vi.fn() }))
vi.mock('../../lib/supabase', () => ({ getSupabaseClient: vi.fn() }))

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
