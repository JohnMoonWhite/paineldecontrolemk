import type { OrderSyncRecords } from './ordersync-types.ts'

/** A payment the source actually received, attributed to the customer that owns it. */
export type SystemPayment = {
  reference: string
  external_id: string
  entity_kind: 'individual' | 'organization'
  method: 'pix' | 'stripe'
  paid_at: string
  amount_cents: number
}

const paidPixStatuses = new Set(['paid', 'approved'])

export function collectPayments(records: OrderSyncRecords): SystemPayment[] {
  const payments: SystemPayment[] = []

  for (const pix of records.pixPayments) {
    if (!pix.paid_at || pix.amount_cents === null) continue
    if (!paidPixStatuses.has(pix.status?.trim().toLowerCase() ?? '')) continue
    const owner = pix.org_id
      ? { external_id: pix.org_id, entity_kind: 'organization' as const }
      : pix.user_id
        ? { external_id: pix.user_id, entity_kind: 'individual' as const }
        : null
    if (!owner) continue
    // The reader has no access to the payment id; owner and payment time identify a payment.
    payments.push({ reference: `pix:${owner.external_id}:${pix.paid_at}`, ...owner, method: 'pix', paid_at: pix.paid_at, amount_cents: pix.amount_cents })
  }

  const stripeOwners = new Map<string, { external_id: string; entity_kind: 'individual' | 'organization' }>()
  for (const organization of records.organizations) {
    if (organization.stripe_subscription_id) stripeOwners.set(organization.stripe_subscription_id, { external_id: organization.id, entity_kind: 'organization' })
  }
  for (const profile of records.profiles) {
    if (profile.stripe_subscription_id) stripeOwners.set(profile.stripe_subscription_id, { external_id: profile.id, entity_kind: 'individual' })
  }

  for (const stripe of records.stripePayments ?? []) {
    const owner = stripeOwners.get(stripe.subscription_id)
    if (!owner || !stripe.paid_at || stripe.amount_cents === null) continue
    payments.push({
      reference: `stripe:${stripe.subscription_id}:${stripe.paid_at}`,
      ...owner,
      method: 'stripe',
      paid_at: stripe.paid_at,
      amount_cents: stripe.amount_cents,
    })
  }

  return payments
}
