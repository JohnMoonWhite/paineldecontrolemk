import { describe, expect, it, vi } from 'vitest'
import { createOrderSyncRequestHandler } from './sync-ordersync-handler'

describe('createOrderSyncRequestHandler', () => {
  it('rejects a caller without the dedicated scheduler credential before reading OrdemSync', async () => {
    const runSync = vi.fn()
    const handler = createOrderSyncRequestHandler({
      schedulerKey: () => 'scheduler-secret',
      runSync,
      now: () => 1_000,
    })

    const response = await handler(new Request('https://central.example/functions/v1/sync-ordersync'))

    expect(response.status).toBe(401)
    expect(runSync).not.toHaveBeenCalled()
    await expect(response.json()).resolves.toEqual({ error: 'Unauthorized' })
  })

  it('returns only the sync summary after an authorized successful read', async () => {
    const handler = createOrderSyncRequestHandler({
      schedulerKey: () => 'scheduler-secret',
      runSync: vi.fn().mockResolvedValue({ status: 'succeeded', factsWritten: 3 }),
      now: vi.fn().mockReturnValueOnce(1_000).mockReturnValueOnce(1_245),
    })

    const response = await handler(
      new Request('https://central.example/functions/v1/sync-ordersync', {
        headers: { apikey: 'scheduler-secret' },
      }),
    )

    expect(response.status).toBe(200)
    await expect(response.json()).resolves.toEqual({
      source: 'ordersync',
      status: 'succeeded',
      factsWritten: 3,
      durationMs: 245,
    })
  })

  it('does not expose source errors when the orchestrator records a failed sync', async () => {
    const handler = createOrderSyncRequestHandler({
      schedulerKey: () => 'scheduler-secret',
      runSync: vi.fn().mockResolvedValue({ status: 'failed' }),
      now: () => 1_000,
    })

    const response = await handler(
      new Request('https://central.example/functions/v1/sync-ordersync', {
        headers: { apikey: 'scheduler-secret' },
      }),
    )

    expect(response.status).toBe(502)
    await expect(response.json()).resolves.toEqual({
      source: 'ordersync',
      status: 'failed',
    })
  })

  it('does not leak details if central failure recording is unavailable', async () => {
    const handler = createOrderSyncRequestHandler({
      schedulerKey: () => 'scheduler-secret',
      runSync: vi.fn().mockRejectedValue(new Error('password authentication failed for source database')),
      now: () => 1_000,
    })

    const response = await handler(
      new Request('https://central.example/functions/v1/sync-ordersync', {
        headers: { apikey: 'scheduler-secret' },
      }),
    )

    expect(response.status).toBe(502)
    await expect(response.json()).resolves.toEqual({ source: 'ordersync', status: 'failed' })
  })
})
