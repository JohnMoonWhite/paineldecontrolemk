import type {
  NormalizedSubscriptionFact,
  OrderSyncOrganization,
  OrderSyncPixPayment,
  OrderSyncProfile,
  OrderSyncRecords,
  OrderSyncStripeSubscription,
} from './ordersync-types.ts'

const activeMembershipStatuses = new Set(['active', 'ativo'])
const paidPaymentStatuses = new Set(['paid', 'approved'])

export function normalizeOrderSync(
  records: OrderSyncRecords,
  observedAt: string,
): NormalizedSubscriptionFact[] {
  const activeMemberIds = new Set(
    records.organizationMembers
      .filter((membership) => activeMembershipStatuses.has(normalizeStatus(membership.status)))
      .map((membership) => membership.user_id),
  )
  const paymentsByOwner = buildPaidPaymentIndex(records.pixPayments)
  const stripeById = new Map((records.stripeSubscriptions ?? []).map((item) => [item.subscription_id, item]))
  const stripeFor = (id: string | null | undefined) => (id ? stripeById.get(id) : undefined)

  const organizations = records.organizations
    .map((organization) => normalizeOrganization(organization, paymentsByOwner.get('organization:' + organization.id), stripeFor(organization.stripe_subscription_id), observedAt))
    .filter((fact): fact is NormalizedSubscriptionFact => fact !== null)

  const individuals = records.profiles
    .filter((profile) => !activeMemberIds.has(profile.id))
    .map((profile) => normalizeProfile(profile, paymentsByOwner.get('individual:' + profile.id), stripeFor(profile.stripe_subscription_id), observedAt))
    .filter((fact): fact is NormalizedSubscriptionFact => fact !== null)

  return [...organizations, ...individuals]
}

function normalizeOrganization(
  organization: OrderSyncOrganization,
  payment: OrderSyncPixPayment | undefined,
  stripe: OrderSyncStripeSubscription | undefined,
  observedAt: string,
): NormalizedSubscriptionFact | null {
  return normalizeEntity(
    {
      externalId: organization.id,
      entityKind: 'organization',
      displayName: organization.nome,
      plan: organization.plano,
      status: organization.subscription_status,
      periodEndAt: organization.current_period_end,
      trialEndAt: organization.trial_ends_at,
      cancelAtPeriodEnd: organization.cancel_at_period_end,
      seatCount: organization.seats,
      provider: organization.payment_provider,
    },
    payment,
    stripe,
    observedAt,
  )
}

function normalizeProfile(
  profile: OrderSyncProfile,
  payment: OrderSyncPixPayment | undefined,
  stripe: OrderSyncStripeSubscription | undefined,
  observedAt: string,
): NormalizedSubscriptionFact | null {
  return normalizeEntity(
    {
      externalId: profile.id,
      entityKind: 'individual',
      displayName: profile.nome,
      plan: profile.plano,
      status: profile.subscription_status,
      periodEndAt: profile.current_period_end,
      trialEndAt: profile.trial_ends_at,
      cancelAtPeriodEnd: profile.cancel_at_period_end,
      seatCount: null,
      provider: profile.payment_provider,
    },
    payment,
    stripe,
    observedAt,
  )
}

function normalizeEntity(
  entity: Omit<NormalizedSubscriptionFact, 'amountCents' | 'currency' | 'observedAt'> & { status: string | null },
  payment: OrderSyncPixPayment | undefined,
  stripe: OrderSyncStripeSubscription | undefined,
  observedAt: string,
): NormalizedSubscriptionFact | null {
  const status = entity.status ?? payment?.status ?? stripe?.status
  if (!status) {
    return null
  }

  return {
    ...entity,
    plan: entity.plan ?? payment?.plan ?? null,
    status,
    periodEndAt: entity.periodEndAt ?? payment?.access_ends_at ?? stripe?.period_end ?? null,
    trialEndAt: entity.trialEndAt ?? null,
    provider: entity.provider ?? (payment ? 'pix' : stripe ? 'stripe' : null),
    amountCents: payment?.amount_cents ?? stripe?.amount_cents ?? null,
    currency: payment?.currency ?? stripe?.currency?.toUpperCase() ?? null,
    observedAt,
  }
}

function buildPaidPaymentIndex(payments: OrderSyncPixPayment[]): Map<string, OrderSyncPixPayment> {
  const index = new Map<string, OrderSyncPixPayment>()

  for (const payment of payments) {
    if (!paidPaymentStatuses.has(normalizeStatus(payment.status))) {
      continue
    }

    const key = payment.org_id
      ? 'organization:' + payment.org_id
      : payment.user_id
        ? 'individual:' + payment.user_id
        : null
    if (!key) {
      continue
    }

    const current = index.get(key)
    if (!current || paymentDate(payment) > paymentDate(current)) {
      index.set(key, payment)
    }
  }

  return index
}

function paymentDate(payment: OrderSyncPixPayment): number {
  return payment.paid_at ? Date.parse(payment.paid_at) || 0 : 0
}

function normalizeStatus(value: string | null): string {
  return value?.trim().toLowerCase() ?? ''
}
