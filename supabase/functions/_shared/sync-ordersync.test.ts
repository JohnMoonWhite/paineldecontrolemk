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

  it('records a safe source-authentication diagnosis without exposing the connection detail', async () => {
    const replaceSnapshot = vi.fn()
    const recordFailure = vi.fn().mockResolvedValue(undefined)

    await executeOrderSync({
      observedAt: '2026-09-29T00:00:00.000Z',
      readRecords: async () => {
        throw new Error('ORDERSYNC_SOURCE_AUTH_FAILED: password authentication failed for role reader')
      },
      replaceSnapshot,
      recordFailure,
    })

    expect(recordFailure).toHaveBeenCalledWith('OrdemSync reader authentication failed')
    expect(recordFailure).not.toHaveBeenCalledWith(expect.stringContaining('password'))
  })

  it('keeps only a safe database error code for source read failures', async () => {
    const recordFailure = vi.fn().mockResolvedValue(undefined)

    await executeOrderSync({
      observedAt: '2026-09-29T00:00:00.000Z',
      readRecords: async () => {
        throw new Error('ORDERSYNC_SOURCE_READ_FAILED:08006:password=do-not-store')
      },
      replaceSnapshot: vi.fn(),
      recordFailure,
    })

    expect(recordFailure).toHaveBeenCalledWith(
      'OrdemSync source read failed (database code 08006)',
    )
    expect(recordFailure).not.toHaveBeenCalledWith(expect.stringContaining('do-not-store'))
  })

  it('keeps a safe driver code or field name for source read failures', async () => {
    const recordFailure = vi.fn().mockResolvedValue(undefined)
    const run = (message: string) =>
      executeOrderSync({
        observedAt: '2026-09-29T00:00:00.000Z',
        readRecords: async () => {
          throw new Error(message)
        },
        replaceSnapshot: vi.fn(),
        recordFailure,
      })

    await run('ORDERSYNC_SOURCE_READ_FAILED:CONNECT_TIMEOUT')
    await run('ORDERSYNC_SOURCE_READ_FAILED:missing:organization_members.user_id')

    expect(recordFailure).toHaveBeenNthCalledWith(1, 'OrdemSync source read failed (CONNECT_TIMEOUT)')
    expect(recordFailure).toHaveBeenNthCalledWith(
      2,
      'OrdemSync source read failed (missing:organization_members.user_id)',
    )
  })

  it('names which configuration rule the source URL failed', async () => {
    const recordFailure = vi.fn().mockResolvedValue(undefined)

    await executeOrderSync({
      observedAt: '2026-09-29T00:00:00.000Z',
      readRecords: async () => {
        throw new Error('ORDERSYNC_SOURCE_CONFIG_FAILED:not_transaction_pooler')
      },
      replaceSnapshot: vi.fn(),
      recordFailure,
    })

    expect(recordFailure).toHaveBeenCalledWith(
      'OrdemSync reader configuration is invalid: URL must use the transaction pooler (port 6543)',
    )
  })

  it('records a safe central-write diagnosis', async () => {
    const recordFailure = vi.fn().mockResolvedValue(undefined)

    await executeOrderSync({
      observedAt: '2026-09-29T00:00:00.000Z',
      readRecords: async () => ({ organizations: [], organizationMembers: [], profiles: [], pixPayments: [] }),
      replaceSnapshot: async () => {
        throw new Error('MONITORING_CENTRAL_WRITE_FAILED')
      },
      recordFailure,
    })

    expect(recordFailure).toHaveBeenCalledWith('Central monitoring database write failed')
  })
})
