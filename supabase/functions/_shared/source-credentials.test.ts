import { describe, expect, it } from 'vitest'
import { resolveOrderSyncCredentials } from './source-credentials'

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
})
