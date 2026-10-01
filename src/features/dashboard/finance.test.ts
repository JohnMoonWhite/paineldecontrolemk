import { describe, expect, it } from 'vitest'
import type { DashboardFact } from './dashboard-query'
import { summarizeFinance } from './finance'

const now = new Date('2026-09-30T12:00:00Z')

function fact(overrides: Partial<DashboardFact>): DashboardFact {
  return {
    source_id: 's1', external_id: 'x', entity_kind: 'individual', display_name: 'Cliente', plan: 'pro',
    status: 'active', period_end_at: '2026-12-01T00:00:00Z', trial_end_at: null, seat_count: null,
    provider: 'mercadopago', amount_cents: 4990, currency: null, ...overrides,
  }
}

describe('summarizeFinance', () => {
  it('adds confirmed monthly values of active subscriptions only', () => {
    const summary = summarizeFinance([
      fact({ external_id: 'a' }),
      fact({ external_id: 'b', amount_cents: 9990 }),
      fact({ external_id: 'c', status: 'trialing', plan: 'gratuito', amount_cents: null }),
      fact({ external_id: 'd', status: 'canceled' }),
    ], [], now)

    expect(summary.payingCount).toBe(2)
    expect(summary.monthlyCents).toBe(14980)
    expect(summary.confirmedCents).toBe(14980)
    expect(summary.annualCents).toBe(14980 * 12)
    expect(summary.averageTicketCents).toBe(7490)
  })

  it('ignores internal accounts', () => {
    const summary = summarizeFinance([
      fact({ external_id: 'a' }),
      fact({ external_id: 'mkhub', entity_kind: 'organization', display_name: 'MKHUB' }),
    ], [{ source_id: 's1', external_id: 'mkhub', entity_kind: 'organization' }], now)

    expect(summary.payingCount).toBe(1)
    expect(summary.monthlyCents).toBe(4990)
    expect(summary.excludedNames).toEqual(['MKHUB'])
  })

  it('estimates a missing value from the most common price of the same plan', () => {
    const summary = summarizeFinance([
      fact({ external_id: 'a' }),
      fact({ external_id: 'b' }),
      fact({ external_id: 'c', amount_cents: null, display_name: 'Sem pagamento' }),
    ], [], now)

    expect(summary.confirmedCents).toBe(9980)
    expect(summary.estimatedCents).toBe(4990)
    expect(summary.estimatedCount).toBe(1)
    expect(summary.monthlyCents).toBe(14970)
  })

  it('lists active subscriptions whose plan has no known price', () => {
    const summary = summarizeFinance([
      fact({ external_id: 'org', entity_kind: 'organization', plan: 'empresas', amount_cents: null, display_name: 'AGRODII' }),
    ], [], now)

    expect(summary.payingCount).toBe(1)
    expect(summary.monthlyCents).toBe(0)
    expect(summary.withoutValue).toEqual(['AGRODII'])
  })

  it('leaves expired subscriptions out of revenue and counts them apart', () => {
    const summary = summarizeFinance([
      fact({ external_id: 'a' }),
      fact({ external_id: 'late', period_end_at: '2026-09-01T00:00:00Z' }),
    ], [], now)

    expect(summary.payingCount).toBe(1)
    expect(summary.expiredActiveCount).toBe(1)
  })

  it('sums the renewals due in the next 30 days', () => {
    const summary = summarizeFinance([
      fact({ external_id: 'soon', period_end_at: '2026-10-10T00:00:00Z' }),
      fact({ external_id: 'later', period_end_at: '2026-12-10T00:00:00Z' }),
    ], [], now)

    expect(summary.renewalsNext30Cents).toBe(4990)
    expect(summary.renewalsNext30Count).toBe(1)
  })

  it('uses a manually informed value when the source has none', () => {
    const summary = summarizeFinance([
      fact({ external_id: 'org', entity_kind: 'organization', plan: 'empresas', amount_cents: null, display_name: 'AGRODII' }),
      fact({ external_id: 'a' }),
    ], [], now, [{ source_id: 's1', external_id: 'org', entity_kind: 'organization', amount_cents: 23900 }])

    expect(summary.monthlyCents).toBe(28890)
    expect(summary.manualCents).toBe(23900)
    expect(summary.manualCount).toBe(1)
    expect(summary.withoutValue).toEqual([])
  })

  it('prefers the value recorded by the source over a manual one', () => {
    const summary = summarizeFinance([
      fact({ external_id: 'a', amount_cents: 5990 }),
    ], [], now, [{ source_id: 's1', external_id: 'a', entity_kind: 'individual', amount_cents: 1000 }])

    expect(summary.monthlyCents).toBe(5990)
    expect(summary.manualCount).toBe(0)
  })

  it('spreads an annual payment over twelve months and renews it at the full value', () => {
    const summary = summarizeFinance([
      fact({ external_id: 'annual', amount_cents: null, period_end_at: '2026-10-15T00:00:00Z', display_name: 'SAMUEL DOURADO' }),
    ], [], now, [{ source_id: 's1', external_id: 'annual', entity_kind: 'individual', amount_cents: 47880, billing_months: 12 }])

    expect(summary.monthlyCents).toBe(3990)
    expect(summary.manualCents).toBe(3990)
    expect(summary.annualCents).toBe(47880)
    expect(summary.renewalsNext30Cents).toBe(47880)
    expect(summary.spreadCount).toBe(1)
  })
})
