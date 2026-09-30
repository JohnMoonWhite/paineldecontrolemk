import { describe, expect, it } from 'vitest'
import { OrderSyncCredentialError, resolveOrderSyncCredentials } from './source-credentials'

describe('resolveOrderSyncCredentials', () => {
  it('rejects an absent source database URL', () => {
    expect(() => resolveOrderSyncCredentials(() => undefined)).toThrow('ORDERSYNC_DATABASE_URL')
  })

  it('rejects a non-Postgres connection URL', () => {
    expect(() =>
      resolveOrderSyncCredentials((name) =>
        name === 'ORDERSYNC_DATABASE_URL' ? 'https://qggkcflrmusfvjqsfhsf.supabase.co' : undefined,
      ),
    ).toThrow('Postgres')
  })

  it('rejects a direct or session-pool connection URL', () => {
    expect(() =>
      resolveOrderSyncCredentials((name) =>
        name === 'ORDERSYNC_DATABASE_URL'
          ? 'postgresql://reader:password@db.qggkcflrmusfvjqsfhsf.supabase.co:5432/postgres'
          : undefined,
      ),
    ).toThrow('transaction-pooler')
  })

  it('returns the validated transaction-pooler URL without exposing it in errors', () => {
    expect(
      resolveOrderSyncCredentials((name) =>
        name === 'ORDERSYNC_DATABASE_URL'
          ? 'postgresql://monitoring_ordersync_reader.qggkcflrmusfvjqsfhsf:secret@aws-1-us-west-1.pooler.supabase.com:6543/postgres'
          : undefined,
      ),
    ).toEqual({
      databaseUrl: 'postgresql://monitoring_ordersync_reader.qggkcflrmusfvjqsfhsf:secret@aws-1-us-west-1.pooler.supabase.com:6543/postgres',
    })
  })

  it.each([
    ['missing', ''],
    ['invalid_url', 'postgresql://reader.ref:ab#cd@aws-0-sa-east-1.pooler.supabase.com:6543/postgres'],
    ['not_transaction_pooler', 'postgresql://reader.ref:pw@aws-0-sa-east-1.pooler.supabase.com:5432/postgres'],
    ['incomplete', 'postgresql://reader.ref@aws-0-sa-east-1.pooler.supabase.com:6543/postgres'],
  ])('reports the safe %s reason without the URL', (reason, value) => {
    let thrown: unknown
    try {
      resolveOrderSyncCredentials(() => value)
    } catch (error) {
      thrown = error
    }

    expect(thrown).toBeInstanceOf(OrderSyncCredentialError)
    expect((thrown as OrderSyncCredentialError).reason).toBe(reason)
    expect(String(thrown)).not.toContain('ab#cd')
  })
})
