import type { SupabaseClient } from '@supabase/supabase-js'
import { loadAllFacts, sourceHealth } from './dashboard-data'

function paginatedClient(failAt?: number) {
  let offset = 0
  const query = {
    select: () => query, eq: () => query, order: () => query,
    range: (from: number, to: number) => {
      expect(to - from).toBe(499)
      offset = from
      return query
    },
    abortSignal: async () => offset === failAt
      ? { data: null, error: { message: 'network error' } }
      : { data: Array.from({ length: Math.min(500, 1001 - offset) }, (_, i) => ({ external_id: String(offset + i) })), error: null },
  }
  return { from: () => query } as unknown as SupabaseClient
}

describe('dashboard data accuracy', () => {
  it('loads records beyond the default API row limit', async () => {
    const facts = await loadAllFacts(paginatedClient(), new AbortController().signal)
    expect(facts).toHaveLength(1001)
    expect(facts[1000].external_id).toBe('1000')
    expect(new Set(facts.map(f => f.external_id)).size).toBe(1001)
  })

  it('rejects a partial snapshot when a later page fails', async () => {
    await expect(loadAllFacts(paginatedClient(500), new AbortController().signal)).rejects.toThrow(/todas as assinaturas/)
  })

  it('marks a stopped sync as stale even if the stored status still says healthy', () => {
    const source = { id: '1', code: 'test', name: 'Test', status: 'healthy', last_success_at: '2026-09-29T12:00:00Z' }
    expect(sourceHealth(source, new Date('2026-09-29T12:14:59Z'))).toBe('healthy')
    expect(sourceHealth(source, new Date('2026-09-29T12:15:00Z'))).toBe('stale')
    expect(sourceHealth({ ...source, last_success_at: null }, new Date())).toBe('pending')
  })
})
