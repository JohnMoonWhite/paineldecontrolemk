export type DashboardFact = {
  source_id?: string
  external_id: string
  entity_kind: 'individual' | 'organization'
  display_name: string | null
  plan: string | null
  status: string
  period_end_at: string | null
  trial_end_at: string | null
  seat_count: number | null
  provider: string | null
}

export type SubscriptionHealth = {
  valid: number
  expiringSoon: number
  expiredOrInconsistent: number
  withoutExpiry: number
  individuals: number
  organizations: number
}

const validStatuses = new Set(['active', 'paid', 'trialing'])

export type FactState = 'valid' | 'expiring' | 'expired' | 'inconsistent' | 'no-expiry' | 'inactive'

export function effectiveExpiry(fact: DashboardFact): string | null {
  return fact.status.toLowerCase() === 'trialing' ? fact.trial_end_at ?? fact.period_end_at : fact.period_end_at
}

export function factState(fact: DashboardFact, now: Date): FactState {
  const expiry = effectiveExpiry(fact)
  if (expiry && !Number.isFinite(Date.parse(expiry))) return 'inconsistent'
  if (expiry && Date.parse(expiry) <= now.getTime()) return 'expired'
  if (!validStatuses.has(fact.status.toLowerCase())) return 'inactive'
  if (!expiry) return 'no-expiry'
  return Date.parse(expiry) <= now.getTime() + 7 * 86400000 ? 'expiring' : 'valid'
}

export const factStateLabels: Record<FactState, string> = {
  valid: 'Válida', expiring: 'Vence em breve', expired: 'Expirada',
  inconsistent: 'Data inconsistente', 'no-expiry': 'Sem vencimento', inactive: 'Inativa',
}

export function summarizeSubscriptionHealth(facts: DashboardFact[], now: Date): SubscriptionHealth {
  let valid = 0
  let expiringSoon = 0
  let expiredOrInconsistent = 0
  let withoutExpiry = 0
  let individuals = 0
  let organizations = 0

  for (const fact of facts) {
    if (fact.entity_kind === 'organization') organizations++
    else individuals++

    const state = factState(fact, now)
    if (state === 'expired' || state === 'inconsistent') expiredOrInconsistent++
    if (!effectiveExpiry(fact)) withoutExpiry++
    if (state === 'valid' || state === 'expiring') valid++
    if (state === 'expiring') expiringSoon++
  }

  return { valid, expiringSoon, expiredOrInconsistent, withoutExpiry, individuals, organizations }
}
