import type { SupabaseClient } from '@supabase/supabase-js'
import { describe, expect, it, vi } from 'vitest'
import { requestSourceSync, waitForSourceSync } from './sync-request'

function clientWith({ rpc, sources }: { rpc?: unknown; sources?: unknown[][] }) {
  const abortSignal = vi.fn()
  for (const rows of sources ?? []) abortSignal.mockResolvedValueOnce({ data: rows, error: null })
  return {
    rpc: vi.fn(() => ({ abortSignal: vi.fn().mockResolvedValue(rpc) })),
    from: vi.fn(() => ({ select: vi.fn(() => ({ abortSignal })) })),
  } as unknown as SupabaseClient
}

const noWait = () => Promise.resolve()

describe('requestSourceSync', () => {
  it('returns the server request time', async () => {
    const client = clientWith({ rpc: { data: '2026-09-30T01:00:00.123456+00:00', error: null } })

    await expect(requestSourceSync(client, new AbortController().signal)).resolves.toBe('2026-09-30T01:00:00.123456+00:00')
    expect(client.rpc).toHaveBeenCalledWith('request_monitoring_sync')
  })

  it('explains that the shown data is preserved when the request is refused', async () => {
    const client = clientWith({ rpc: { data: null, error: { message: 'not authorized' } } })

    await expect(requestSourceSync(client, new AbortController().signal)).rejects.toThrow('última coleta')
  })
})

describe('waitForSourceSync', () => {
  it('resolves once every source attempted a collection after the request', async () => {
    const client = clientWith({
      sources: [
        [{ last_attempt_at: '2026-09-30T00:59:00Z' }],
        [{ last_attempt_at: '2026-09-30T01:00:02Z' }],
      ],
    })

    await expect(
      waitForSourceSync(client, '2026-09-30T01:00:00Z', new AbortController().signal, { sleep: noWait }),
    ).resolves.toBe(true)
  })

  it('gives up after the attempt limit', async () => {
    const stale = [{ last_attempt_at: '2026-09-30T00:59:00Z' }]
    const client = clientWith({ sources: [stale, stale, stale] })

    await expect(
      waitForSourceSync(client, '2026-09-30T01:00:00Z', new AbortController().signal, { sleep: noWait, attempts: 3 }),
    ).resolves.toBe(false)
  })
})
