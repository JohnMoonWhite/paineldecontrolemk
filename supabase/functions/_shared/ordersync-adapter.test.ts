import { describe, expect, it } from 'vitest'
import { normalizeOrderSync } from './ordersync-adapter'

const observedAt = '2026-09-29T00:00:00.000Z'

describe('normalizeOrderSync', () => {
  it('keeps an organization subscription with its operational details', () => {
    const facts = normalizeOrderSync(
      {
        organizations: [
          {
            id: 'org-1',
            nome: 'Oficina Norte',
            plano: 'Pro',
            subscription_status: 'active',
            current_period_end: '2026-10-20T00:00:00.000Z',
            trial_ends_at: null,
            cancel_at_period_end: false,
            payment_provider: 'stripe',
            seats: 8,
          },
        ],
        organizationMembers: [],
        profiles: [],
        pixPayments: [],
      },
      observedAt,
    )

    expect(facts).toEqual([
      expect.objectContaining({
        externalId: 'org-1',
        entityKind: 'organization',
        displayName: 'Oficina Norte',
        plan: 'Pro',
        seatCount: 8,
        provider: 'stripe',
      }),
    ])
  })

  it('does not emit an individual fact for an active organization member', () => {
    const facts = normalizeOrderSync(
      {
        organizations: [],
        organizationMembers: [{ org_id: 'org-1', user_id: 'user-1', status: 'ativo' }],
        profiles: [
          {
            id: 'user-1',
            nome: 'Pessoa da organização',
            plano: 'Individual',
            subscription_status: 'active',
            current_period_end: '2026-10-20T00:00:00.000Z',
          },
        ],
        pixPayments: [],
      },
      observedAt,
    )

    expect(facts).toEqual([])
  })

  it('keeps a standalone profile and maps nome without carrying an email field', () => {
    const facts = normalizeOrderSync(
      {
        organizations: [],
        organizationMembers: [],
        profiles: [
          {
            id: 'user-2',
            nome: 'Assinante individual',
            plano: 'Essencial',
            subscription_status: 'active',
            current_period_end: '2026-10-20T00:00:00.000Z',
          },
        ],
        pixPayments: [],
      },
      observedAt,
    )

    expect(facts).toEqual([
      expect.objectContaining({
        externalId: 'user-2',
        entityKind: 'individual',
        displayName: 'Assinante individual',
        status: 'active',
      }),
    ])
    expect(JSON.stringify(facts)).not.toContain('email')
  })

  it('preserves an active record whose period end is already past for the dashboard to flag', () => {
    const facts = normalizeOrderSync(
      {
        organizations: [],
        organizationMembers: [],
        profiles: [
          {
            id: 'user-3',
            nome: 'Expiração divergente',
            plano: 'Pro',
            subscription_status: 'active',
            current_period_end: '2026-09-01T00:00:00.000Z',
          },
        ],
        pixPayments: [],
      },
      observedAt,
    )

    expect(facts[0]).toMatchObject({
      status: 'active',
      periodEndAt: '2026-09-01T00:00:00.000Z',
    })
  })

  it('keeps trial status and uses a paid Pix access end only when profile fields are missing', () => {
    const facts = normalizeOrderSync(
      {
        organizations: [],
        organizationMembers: [],
        profiles: [
          {
            id: 'user-4',
            nome: 'Teste',
            plano: null,
            subscription_status: 'trialing',
            trial_ends_at: '2026-10-03T00:00:00.000Z',
            current_period_end: null,
          },
          {
            id: 'user-5',
            nome: 'Pix',
            plano: null,
            subscription_status: null,
            current_period_end: null,
          },
        ],
        pixPayments: [
          {
            user_id: 'user-5',
            org_id: null,
            status: 'paid',
            plan: 'Pix Pro',
            amount_cents: 11960,
            currency: 'BRL',
            access_ends_at: '2026-11-01T00:00:00.000Z',
            paid_at: '2026-09-28T00:00:00.000Z',
          },
        ],
      },
      observedAt,
    )

    expect(facts).toEqual(
      expect.arrayContaining([
        expect.objectContaining({ externalId: 'user-4', status: 'trialing', trialEndAt: '2026-10-03T00:00:00.000Z' }),
        expect.objectContaining({
          externalId: 'user-5',
          status: 'paid',
          plan: 'Pix Pro',
          amountCents: 11960,
          periodEndAt: '2026-11-01T00:00:00.000Z',
        }),
      ]),
    )
  })

  it('fills due date, value and provider from the latest Stripe subscription state', () => {
    const facts = normalizeOrderSync(
      {
        organizations: [],
        organizationMembers: [],
        profiles: [
          {
            id: 'profile-1',
            nome: 'AGRI COTTON',
            plano: 'pro',
            subscription_status: 'active',
            current_period_end: null,
            payment_provider: null,
            stripe_subscription_id: 'sub_1',
          },
        ],
        pixPayments: [],
        stripeSubscriptions: [
          { subscription_id: 'sub_1', status: 'active', period_end: '2026-10-06T22:49:24.000Z', amount_cents: 4990, currency: 'brl' },
        ],
      },
      observedAt,
    )

    expect(facts[0]).toEqual(expect.objectContaining({
      periodEndAt: '2026-10-06T22:49:24.000Z',
      amountCents: 4990,
      currency: 'BRL',
      provider: 'stripe',
      status: 'active',
    }))
  })

  it('summarizes the payment history and method of each customer', () => {
    const facts = normalizeOrderSync(
      {
        organizations: [],
        organizationMembers: [],
        profiles: [
          { id: 'pix-user', nome: 'Pix', plano: 'pro', subscription_status: 'active', payment_provider: 'mercadopago' },
          { id: 'card-user', nome: 'Card', plano: 'pro', subscription_status: 'active', stripe_subscription_id: 'sub_1' },
          { id: 'free-user', nome: 'Free', plano: 'gratuito', subscription_status: 'trialing' },
        ],
        pixPayments: [
          { user_id: 'pix-user', org_id: null, status: 'approved', plan: 'monthly', amount_cents: 4990, currency: null, access_ends_at: '2026-08-01T00:00:00.000Z', paid_at: '2026-07-01T00:00:00.000Z' },
          { user_id: 'pix-user', org_id: null, status: 'approved', plan: 'monthly', amount_cents: 4990, currency: null, access_ends_at: '2026-09-01T00:00:00.000Z', paid_at: '2026-08-01T00:00:00.000Z' },
          { user_id: 'pix-user', org_id: null, status: 'cancelled', plan: 'monthly', amount_cents: 4990, currency: null, access_ends_at: null, paid_at: null },
        ],
        stripeSubscriptions: [
          { subscription_id: 'sub_1', status: 'active', period_end: '2026-10-06T00:00:00.000Z', amount_cents: 4990, currency: 'brl' },
        ],
      },
      observedAt,
    )

    const byId = Object.fromEntries(facts.map((fact) => [fact.externalId, fact]))
    expect(byId['pix-user']).toEqual(expect.objectContaining({
      paymentMethod: 'pix', paymentsCount: 2, firstPaidAt: '2026-07-01T00:00:00.000Z', lastPaidAt: '2026-08-01T00:00:00.000Z',
    }))
    expect(byId['card-user']).toEqual(expect.objectContaining({ paymentMethod: 'stripe', paymentsCount: 0 }))
    expect(byId['free-user']).toEqual(expect.objectContaining({ paymentMethod: null, paymentsCount: 0, firstPaidAt: null }))
  })
})
