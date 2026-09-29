export type DashboardFact = {
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

export function summarizeSubscriptionHealth(facts: DashboardFact[], now: Date): SubscriptionHealth {
  const nowTime = now.getTime()
  const weekFromNow = nowTime + 7 * 24 * 60 * 60 * 1000
  let valid = 0
  let expiringSoon = 0
  let expiredOrInconsistent = 0
  let withoutExpiry = 0
  let individuals = 0
  let organizations = 0

  for (const fact of facts) {
    if (fact.entity_kind === 'organization') organizations++
    else individuals++

    const endTime = fact.period_end_at ? Date.parse(fact.period_end_at) : NaN
    if (!Number.isNaN(endTime) && endTime < nowTime) expiredOrInconsistent++
    if (!fact.period_end_at) withoutExpiry++
    if (validStatuses.has(fact.status.toLowerCase()) && (Number.isNaN(endTime) || endTime >= nowTime)) valid++
    if (!Number.isNaN(endTime) && endTime >= nowTime && endTime <= weekFromNow) expiringSoon++
  }

  return { valid, expiringSoon, expiredOrInconsistent, withoutExpiry, individuals, organizations }
}
