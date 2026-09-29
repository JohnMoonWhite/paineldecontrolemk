import { describe, expect, it, vi } from 'vitest'
import { readOrderSyncRecords } from './ordersync-source-reader'

describe('readOrderSyncRecords', () => {
  it('reads exactly the approved OrdemSync fields without source emails or raw payments', async () => {
    const query = vi
      .fn()
      .mockResolvedValueOnce([{ id: 'profile-1', nome: 'Cliente', plano: 'Pro', subscription_status: 'active' }])
      .mockResolvedValueOnce([{ id: 'org-1', nome: 'Empresa', plano: 'Business', subscription_status: 'active', seats: 5 }])
      .mockResolvedValueOnce([{ org_id: 'org-1', user_id: 'profile-1', status: 'active' }])
      .mockResolvedValueOnce([{ user_id: null, org_id: 'org-1', status: 'paid', plan: 'Business', amount_cents: 4990 }])

    const records = await readOrderSyncRecords(query)

    expect(records.profiles).toHaveLength(1)
    expect(records.organizations).toHaveLength(1)
    expect(records.organizationMembers).toHaveLength(1)
    expect(records.pixPayments).toHaveLength(1)
    expect(query).toHaveBeenCalledTimes(4)

    const requestedColumns = query.mock.calls.map(([statement]) => statement).join(' ').toLowerCase()
    expect(requestedColumns).not.toContain('email')
    expect(requestedColumns).not.toContain('raw')
    expect(requestedColumns).toContain('from public.profiles')
    expect(requestedColumns).toContain('from public.organizations')
    expect(requestedColumns).toContain('from public.organization_members')
    expect(requestedColumns).toContain('from public.pix_payments')
  })

  it('does not return a partial snapshot when one approved source query fails', async () => {
    const query = vi
      .fn()
      .mockResolvedValueOnce([])
      .mockRejectedValueOnce(new Error('permission denied'))

    await expect(readOrderSyncRecords(query)).rejects.toThrow('permission denied')
  })

  it('serializes reads for the transaction pooler instead of pipelining queries', async () => {
    let releaseFirstQuery: (() => void) | undefined
    const query = vi.fn((statement: string) => {
      if (statement.toLowerCase().includes('from public.profiles')) {
        return new Promise<Record<string, unknown>[]>((resolve) => {
          releaseFirstQuery = () => resolve([])
        })
      }

      return Promise.resolve([])
    })

    const pending = readOrderSyncRecords(query)
    await Promise.resolve()

    expect(query).toHaveBeenCalledTimes(1)
    releaseFirstQuery?.()
    await expect(pending).resolves.toEqual({
      profiles: [],
      organizations: [],
      organizationMembers: [],
      pixPayments: [],
    })
  })
})
