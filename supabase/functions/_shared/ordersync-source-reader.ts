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
    organizationMembers: organizationMembers.map(toOrganizationMember),
    pixPayments: pixPayments.map(toPixPayment),
  }
}

function toProfile(row: Record<string, unknown>): OrderSyncProfile {
  return {
    id: requiredString(row.id, 'profiles.id'),
    nome: nullableString(row.nome),
    plano: nullableString(row.plano),
    subscription_status: nullableString(row.subscription_status),
    trial_ends_at: nullableString(row.trial_ends_at),
    current_period_end: nullableString(row.current_period_end),
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
    current_period_end: nullableString(row.current_period_end),
    trial_ends_at: nullableString(row.trial_ends_at),
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
    access_ends_at: nullableString(row.access_ends_at),
    paid_at: nullableString(row.paid_at),
  }
}

function requiredString(value: unknown, field: string): string {
  if (typeof value !== 'string' || !value) {
    throw new Error(field + ' is missing')
  }

  return value
}

function nullableString(value: unknown): string | null {
  return typeof value === 'string' ? value : null
}

function nullableBoolean(value: unknown): boolean | null {
  return typeof value === 'boolean' ? value : null
}

function nullableNumber(value: unknown): number | null {
  return typeof value === 'number' && Number.isFinite(value) ? value : null
}
