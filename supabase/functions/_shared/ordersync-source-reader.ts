import type {
  OrderSyncOrganization,
  OrderSyncOrganizationMember,
  OrderSyncPixPayment,
  OrderSyncProfile,
  OrderSyncRecords,
} from './ordersync-types.ts'

export type SourceQuery = (statement: string) => Promise<Record<string, unknown>[]>

const profilesQuery = `
  select id, nome, plano, subscription_status, trial_ends_at, current_period_end,
    cancel_at_period_end, payment_provider
  from public.profiles
`

const organizationsQuery = `
  select id, nome, plano, subscription_status, current_period_end, trial_ends_at,
    payment_provider, seats
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

export async function readOrderSyncRecords(query: SourceQuery): Promise<OrderSyncRecords> {
  const profiles = await query(profilesQuery)
  const organizations = await query(organizationsQuery)
  const organizationMembers = await query(organizationMembersQuery)
  const pixPayments = await query(pixPaymentsQuery)

  return {
    profiles: profiles.map(toProfile),
    organizations: organizations.map(toOrganization),
    // Memberships without a linked user (e.g. pending invites) cannot exclude any profile.
    organizationMembers: organizationMembers
      .filter((row) => isPresentString(row.org_id) && isPresentString(row.user_id))
      .map(toOrganizationMember),
    pixPayments: pixPayments.map(toPixPayment),
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
