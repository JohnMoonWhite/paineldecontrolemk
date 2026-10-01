import type {
  OrderSyncOrganization,
  OrderSyncOrganizationMember,
  OrderSyncPixPayment,
  OrderSyncProfile,
  OrderSyncRecords,
  OrderSyncStripePayment,
  OrderSyncStripeSubscription,
} from './ordersync-types.ts'

export type SourceQuery = (statement: string) => Promise<Record<string, unknown>[]>

const profilesQuery = `
  select id, nome, plano, subscription_status, trial_ends_at, current_period_end,
    cancel_at_period_end, payment_provider, stripe_subscription_id
  from public.profiles
`

const organizationsQuery = `
  select id, nome, plano, subscription_status, current_period_end, trial_ends_at,
    payment_provider, seats, stripe_subscription_id
  from public.organizations
`

const organizationMembersQuery = `
  select org_id, user_id, status
  from public.organization_members
`

const pixPaymentsQuery = `
  select user_id, org_id, plan, amount_cents, status, access_ends_at, paid_at
  from public.pix_payments
`

// A view in the source exposes only status, due date and value of each Stripe subscription,
// so the reader never touches the raw webhook payload (see docs/source-credentials-ordersync.md).
const stripeSubscriptionsQuery = `
  select subscription_id, status, period_end, amount_cents, currency
  from monitoring.stripe_subscriptions
`

const stripePaymentsQuery = `
  select subscription_id, paid_at, amount_cents, currency
  from monitoring.stripe_payments
`

// The Stripe payments view is created separately in the source; until it exists, or while the
// reader lacks access to it, the collection carries on without Stripe payments.
const optionalRelationErrors = new Set(['42P01', '42501'])

async function readOptional(query: SourceQuery, statement: string): Promise<Record<string, unknown>[]> {
  try {
    return await query(statement)
  } catch (error) {
    const code = typeof error === 'object' && error !== null && 'code' in error ? String(error.code) : ''
    if (optionalRelationErrors.has(code)) return []
    throw error
  }
}

export async function readOrderSyncRecords(query: SourceQuery): Promise<OrderSyncRecords> {
  const profiles = await query(profilesQuery)
  const organizations = await query(organizationsQuery)
  const organizationMembers = await query(organizationMembersQuery)
  const pixPayments = await query(pixPaymentsQuery)
  const stripeSubscriptions = await query(stripeSubscriptionsQuery)
  const stripePayments = await readOptional(query, stripePaymentsQuery)

  return {
    profiles: profiles.map(toProfile),
    organizations: organizations.map(toOrganization),
    // Memberships without a linked user (e.g. pending invites) cannot exclude any profile.
    organizationMembers: organizationMembers
      .filter((row) => isPresentString(row.org_id) && isPresentString(row.user_id))
      .map(toOrganizationMember),
    pixPayments: pixPayments.map(toPixPayment),
    stripeSubscriptions: stripeSubscriptions.map(toStripeSubscription),
    stripePayments: stripePayments.map(toStripePayment),
  }
}

function toProfile(row: Record<string, unknown>): OrderSyncProfile {
  return {
    id: requiredString(row.id, 'profiles.id'),
    nome: nullableString(row.nome),
    plano: nullableString(row.plano),
    subscription_status: nullableString(row.subscription_status),
    trial_ends_at: nullableTimestamp(row.trial_ends_at),
    current_period_end: nullableTimestamp(row.current_period_end),
    cancel_at_period_end: nullableBoolean(row.cancel_at_period_end),
    payment_provider: nullableString(row.payment_provider),
    stripe_subscription_id: nullableString(row.stripe_subscription_id),
  }
}

function toOrganization(row: Record<string, unknown>): OrderSyncOrganization {
  return {
    id: requiredString(row.id, 'organizations.id'),
    nome: nullableString(row.nome),
    plano: nullableString(row.plano),
    subscription_status: nullableString(row.subscription_status),
    current_period_end: nullableTimestamp(row.current_period_end),
    trial_ends_at: nullableTimestamp(row.trial_ends_at),
    payment_provider: nullableString(row.payment_provider),
    seats: nullableNumber(row.seats),
    stripe_subscription_id: nullableString(row.stripe_subscription_id),
  }
}

function toOrganizationMember(row: Record<string, unknown>): OrderSyncOrganizationMember {
  return {
    org_id: requiredString(row.org_id, 'organization_members.org_id'),
    user_id: requiredString(row.user_id, 'organization_members.user_id'),
    status: nullableString(row.status),
  }
}

function toPixPayment(row: Record<string, unknown>): OrderSyncPixPayment {
  return {
    user_id: nullableString(row.user_id),
    org_id: nullableString(row.org_id),
    status: nullableString(row.status),
    plan: nullableString(row.plan),
    amount_cents: nullableNumber(row.amount_cents),
    currency: null,
    access_ends_at: nullableTimestamp(row.access_ends_at),
    paid_at: nullableTimestamp(row.paid_at),
  }
}

function toStripeSubscription(row: Record<string, unknown>): OrderSyncStripeSubscription {
  return {
    subscription_id: requiredString(row.subscription_id, 'stripe_events.subscription_id'),
    status: nullableString(row.status),
    period_end: nullableTimestamp(row.period_end),
    amount_cents: nullableNumber(row.amount_cents),
    currency: nullableString(row.currency),
  }
}

function toStripePayment(row: Record<string, unknown>): OrderSyncStripePayment {
  return {
    subscription_id: requiredString(row.subscription_id, 'stripe_payments.subscription_id'),
    paid_at: nullableTimestamp(row.paid_at),
    amount_cents: nullableNumber(row.amount_cents),
    currency: nullableString(row.currency),
  }
}

function requiredString(value: unknown, field: string): string {
  if (typeof value !== 'string' || !value) {
    throw new Error(field + ' is missing')
  }

  return value
}

function isPresentString(value: unknown): boolean {
  return typeof value === 'string' && value !== ''
}

function nullableString(value: unknown): string | null {
  return typeof value === 'string' ? value : null
}

// postgres.js returns date/timestamp columns as Date objects.
function nullableTimestamp(value: unknown): string | null {
  if (value instanceof Date) {
    return Number.isNaN(value.getTime()) ? null : value.toISOString()
  }

  return nullableString(value)
}

function nullableBoolean(value: unknown): boolean | null {
  return typeof value === 'boolean' ? value : null
}

// postgres.js returns bigint and numeric columns as strings.
function nullableNumber(value: unknown): number | null {
  const number = typeof value === 'string' && value.trim() ? Number(value) : value
  return typeof number === 'number' && Number.isFinite(number) ? number : null
}
