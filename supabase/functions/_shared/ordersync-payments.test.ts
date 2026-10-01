import { describe, expect, it } from 'vitest'
import { collectPayments } from './ordersync-payments'

describe('collectPayments', () => {
  it('lists every approved Pix payment and every paid Stripe period with its customer', () => {
    const payments = collectPayments({
      organizations: [{ id: 'org-1', nome: 'Empresa', plano: 'empresas', subscription_status: 'active' }],
      organizationMembers: [],
      profiles: [{ id: 'card-user', nome: 'Card', plano: 'pro', subscription_status: 'active', stripe_subscription_id: 'sub_1' }],
      pixPayments: [
        { user_id: 'u1', org_id: null, status: 'approved', plan: 'monthly', amount_cents: 4990, currency: null, access_ends_at: null, paid_at: '2026-08-01T10:00:00.000Z' },
        { user_id: 'u2', org_id: 'org-1', status: 'approved', plan: 'monthly', amount_cents: 8990, currency: null, access_ends_at: null, paid_at: '2026-09-30T10:00:00.000Z' },
        { user_id: 'u1', org_id: null, status: 'cancelled', plan: 'monthly', amount_cents: 4990, currency: null, access_ends_at: null, paid_at: null },
      ],
      stripePayments: [
        { subscription_id: 'sub_1', paid_at: '2026-09-06T22:49:24.000Z', amount_cents: 4990, currency: 'brl' },
        { subscription_id: 'sub_unknown', paid_at: '2026-09-07T00:00:00.000Z', amount_cents: 1000, currency: 'brl' },
      ],
    })

    expect(payments).toEqual([
      { reference: 'pix:u1:2026-08-01T10:00:00.000Z', external_id: 'u1', entity_kind: 'individual', method: 'pix', paid_at: '2026-08-01T10:00:00.000Z', amount_cents: 4990 },
      { reference: 'pix:org-1:2026-09-30T10:00:00.000Z', external_id: 'org-1', entity_kind: 'organization', method: 'pix', paid_at: '2026-09-30T10:00:00.000Z', amount_cents: 8990 },
      { reference: 'stripe:sub_1:2026-09-06T22:49:24.000Z', external_id: 'card-user', entity_kind: 'individual', method: 'stripe', paid_at: '2026-09-06T22:49:24.000Z', amount_cents: 4990 },
    ])
  })
})
