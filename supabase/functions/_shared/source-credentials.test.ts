import { describe, expect, it } from 'vitest'
import { resolveOrderSyncCredentials } from './source-credentials'

describe('resolveOrderSyncCredentials', () => {
  it('rejects an absent source URL', () => {
    expect(() => resolveOrderSyncCredentials(() => undefined)).toThrow('ORDERSYNC_SUPABASE_URL')
  })

  it('rejects an absent read-only key', () => {
    expect(() =>
      resolveOrderSyncCredentials((name) =>
        name === 'ORDERSYNC_SUPABASE_URL' ? 'https://qggkcflrmusfvjqsfhsf.supabase.co' : undefined,
      ),
    ).toThrow('ORDERSYNC_READONLY_KEY')
  })

  it('rejects a non-HTTPS source URL', () => {
    expect(() =>
      resolveOrderSyncCredentials((name) =>
        name === 'ORDERSYNC_SUPABASE_URL' ? 'http://qggkcflrmusfvjqsfhsf.supabase.co' : 'read-only-key',
      ),
    ).toThrow('HTTPS')
  })

  it('returns only validated server configuration', () => {
    expect(
      resolveOrderSyncCredentials((name) =>
        name === 'ORDERSYNC_SUPABASE_URL'
          ? 'https://qggkcflrmusfvjqsfhsf.supabase.co'
          : 'read-only-key',
      ),
    ).toEqual({
      url: 'https://qggkcflrmusfvjqsfhsf.supabase.co',
      key: 'read-only-key',
    })
  })
})
