import { describe, expect, it, vi } from 'vitest'
import { executeOrderSync } from './sync-ordersync'

describe('executeOrderSync', () => {
  it('writes one complete snapshot after all source reads succeed', async () => {
    const replaceSnapshot = vi.fn().mockResolvedValue(1)
    const recordFailure = vi.fn()

    const result = await executeOrderSync({
      observedAt: '2026-09-29T00:00:00.000Z',
      readRecords: async () => ({
        organizations: [],
        organizationMembers: [],
        profiles: [
          {
            id: 'profile-1',
            nome: 'Cliente',
            plano: 'Pro',
            subscription_status: 'active',
          },
        ],
        pixPayments: [],
      }),
      replaceSnapshot,
      recordFailure,
    })

    expect(result).toEqual({ status: 'succeeded', factsWritten: 1 })
    expect(replaceSnapshot).toHaveBeenCalledOnce()
    expect(recordFailure).not.toHaveBeenCalled()
  })

  it('records failure without attempting a snapshot replacement', async () => {
    const replaceSnapshot = vi.fn()
    const recordFailure = vi.fn().mockResolvedValue(undefined)

    const result = await executeOrderSync({
      observedAt: '2026-09-29T00:00:00.000Z',
      readRecords: async () => {
        throw new Error('source unavailable')
      },
      replaceSnapshot,
      recordFailure,
    })

    expect(result).toEqual({ status: 'failed' })
    expect(replaceSnapshot).not.toHaveBeenCalled()
    expect(recordFailure).toHaveBeenCalledWith('Unable to synchronize approved OrdemSync data')
  })
})
