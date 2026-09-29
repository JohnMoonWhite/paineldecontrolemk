import { describe, expect, it } from 'vitest'
import { summarizeSubscriptionHealth, type DashboardFact } from './dashboard-query'

const facts: DashboardFact[] = [
  { external_id: 'org-1', entity_kind: 'organization', display_name: 'Oficina Norte', plan: 'Pro', status: 'active', period_end_at: '2026-10-04T00:00:00.000Z', trial_end_at: null, seat_count: 8, provider: 'stripe' },
  { external_id: 'person-1', entity_kind: 'individual', display_name: 'Cliente direto', plan: 'Essencial', status: 'active', period_end_at: '2026-10-02T00:00:00.000Z', trial_end_at: null, seat_count: null, provider: 'pix' },
  { external_id: 'person-2', entity_kind: 'individual', display_name: 'Sem data', plan: 'Pro', status: 'paid', period_end_at: null, trial_end_at: null, seat_count: null, provider: 'pix' },
  { external_id: 'person-3', entity_kind: 'individual', display_name: 'Expirado', plan: 'Pro', status: 'active', period_end_at: '2026-09-20T00:00:00.000Z', trial_end_at: null, seat_count: null, provider: 'stripe' },
]

describe('summarizeSubscriptionHealth', () => {
  it('keeps individual and organization subscriptions independent while highlighting dates', () => {
    expect(summarizeSubscriptionHealth(facts, new Date('2026-09-29T00:00:00.000Z'))).toEqual({
      valid: 3,
      expiringSoon: 2,
      expiredOrInconsistent: 1,
      withoutExpiry: 1,
      individuals: 3,
      organizations: 1,
    })
  })

  it('does not carry source emails into the dashboard model', () => {
    expect(JSON.stringify(facts)).not.toContain('email')
  })
})
