import { describe, expect, it } from 'vitest'
import type { DashboardFact } from './dashboard-query'
import { paymentMethodLabel, relationship } from './relationship'

const now = new Date('2026-09-30T12:00:00Z')

function fact(overrides: Partial<DashboardFact>): DashboardFact {
  return {
    external_id: 'x', entity_kind: 'individual', display_name: 'Cliente', plan: 'pro', status: 'active',
    period_end_at: '2026-10-30T00:00:00Z', trial_end_at: null, seat_count: null, provider: null,
    payment_method: null, payments_count: 0, ...overrides,
  }
}

describe('relationship', () => {
  it('recognizes a current subscriber and a scheduled cancellation', () => {
    expect(relationship(fact({}), now)).toBe('subscriber')
    expect(relationship(fact({ cancel_at_period_end: true }), now)).toBe('cancelling')
  })

  it('separates running trials from trials that ended without payment', () => {
    expect(relationship(fact({ status: 'trialing', period_end_at: null, trial_end_at: '2026-10-05T00:00:00Z' }), now)).toBe('trial')
    expect(relationship(fact({ status: 'trialing', plan: 'empresas', period_end_at: null, trial_end_at: '2026-07-26T00:00:00Z' }), now)).toBe('trial-expired')
  })

  it('treats the free plan as its own situation, whatever its old trial date says', () => {
    expect(relationship(fact({ status: 'trialing', plan: 'gratuito', period_end_at: null, trial_end_at: '2026-07-26T00:00:00Z' }), now)).toBe('free')
    expect(relationship(fact({ status: 'trialing', plan: 'gratuito', period_end_at: null, trial_end_at: '2026-12-26T00:00:00Z' }), now)).toBe('free')
  })

  it('marks as former subscriber whoever paid and no longer has a valid subscription', () => {
    expect(relationship(fact({ period_end_at: '2026-09-01T00:00:00Z', payment_method: 'pix', payments_count: 3 }), now)).toBe('former')
    expect(relationship(fact({ status: 'canceled', payment_method: 'stripe' }), now)).toBe('former')
    expect(relationship(fact({ status: 'trialing', plan: 'gratuito', period_end_at: null, trial_end_at: '2026-07-26T00:00:00Z', payments_count: 2 }), now)).toBe('former')
  })

  it('flags late payments and inactive records that never paid', () => {
    expect(relationship(fact({ status: 'past_due' }), now)).toBe('overdue')
    expect(relationship(fact({ status: 'incomplete_expired', period_end_at: null }), now)).toBe('inactive')
  })
})

describe('paymentMethodLabel', () => {
  it('names the payment method in plain language', () => {
    expect(paymentMethodLabel('pix')).toBe('PIX')
    expect(paymentMethodLabel('stripe')).toBe('Cartão (Stripe)')
    expect(paymentMethodLabel('mercadopago')).toBe('Mercado Pago')
    expect(paymentMethodLabel(null)).toBe('Não informado')
  })
})
