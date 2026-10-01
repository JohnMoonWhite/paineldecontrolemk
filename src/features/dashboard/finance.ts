import { factState, type DashboardFact } from './dashboard-query'

export type FinanceExclusion = { source_id: string; external_id: string; entity_kind: string }
/** Value charged per billing cycle; `billing_months` is 12 for an annual plan. */
export type ManualAmount = FinanceExclusion & { amount_cents: number; billing_months?: number | null }

export type FinanceSummary = {
  payingCount: number
  monthlyCents: number
  confirmedCents: number
  estimatedCents: number
  estimatedCount: number
  manualCents: number
  manualCount: number
  /** Subscriptions paid for several months at once, counted at their monthly share. */
  spreadCount: number
  annualCents: number
  averageTicketCents: number
  renewalsNext30Cents: number
  renewalsNext30Count: number
  expiredActiveCount: number
  withoutValue: string[]
  excludedNames: string[]
}

const payingStatuses = new Set(['active', 'paid'])

const exclusionKey = (item: { source_id?: string; external_id: string; entity_kind: string }) =>
  `${item.source_id ?? ''}:${item.entity_kind}:${item.external_id}`

/** Facts without the internal accounts (admins, tests), for any total shown on the dashboard. */
export function withoutExcluded(facts: DashboardFact[], exclusions: FinanceExclusion[]): DashboardFact[] {
  const excluded = new Set(exclusions.map(exclusionKey))
  return facts.filter(fact => !excluded.has(exclusionKey(fact)))
}

/**
 * Monthly revenue of active, non-internal subscriptions. A subscription without a value
 * recorded by the source uses a manually informed value, else the most common value of the
 * same plan; if neither exists it is listed in `withoutValue` instead.
 */
export function summarizeFinance(
  facts: DashboardFact[],
  exclusions: FinanceExclusion[],
  now: Date,
  manualAmounts: ManualAmount[] = [],
): FinanceSummary {
  const excluded = new Set(exclusions.map(exclusionKey))
  const manual = new Map(manualAmounts.map(item => [exclusionKey(item), item]))
  const excludedNames: string[] = []
  const active: DashboardFact[] = []
  let expiredActiveCount = 0

  for (const fact of facts) {
    if (excluded.has(exclusionKey(fact))) { excludedNames.push(fact.display_name?.trim() || fact.external_id); continue }
    if (!payingStatuses.has(fact.status.toLowerCase())) continue
    if (factState(fact, now) === 'expired') { expiredActiveCount++; continue }
    active.push(fact)
  }

  const referencePrice = mostCommonAmountByPlan(active)
  const renewalLimit = now.getTime() + 30 * 86400000
  let confirmedCents = 0
  let estimatedCents = 0
  let estimatedCount = 0
  let manualCents = 0
  let manualCount = 0
  let spreadCount = 0
  let renewalsNext30Cents = 0
  let renewalsNext30Count = 0
  const withoutValue: string[] = []

  for (const fact of active) {
    const confirmed = fact.amount_cents ?? null
    const informed = confirmed === null ? manual.get(exclusionKey(fact)) ?? null : null
    const billingMonths = Math.max(1, informed?.billing_months ?? 1)
    const cycleAmount = confirmed ?? informed?.amount_cents ?? referencePrice.get(planKey(fact)) ?? null
    if (cycleAmount === null) { withoutValue.push(fact.display_name?.trim() || fact.external_id); continue }
    const amount = Math.round(cycleAmount / billingMonths)
    if (billingMonths > 1) spreadCount++
    if (confirmed !== null) confirmedCents += amount
    else if (informed) { manualCents += amount; manualCount++ }
    else { estimatedCents += amount; estimatedCount++ }

    // A renewal charges the whole cycle, so an annual plan renews at its full value.
    const periodEnd = fact.period_end_at ? Date.parse(fact.period_end_at) : NaN
    if (Number.isFinite(periodEnd) && periodEnd <= renewalLimit) { renewalsNext30Cents += cycleAmount; renewalsNext30Count++ }
  }

  const monthlyCents = confirmedCents + manualCents + estimatedCents
  const valued = active.length - withoutValue.length
  return {
    payingCount: active.length,
    monthlyCents,
    confirmedCents,
    estimatedCents,
    estimatedCount,
    manualCents,
    manualCount,
    spreadCount,
    annualCents: monthlyCents * 12,
    averageTicketCents: valued ? Math.round(monthlyCents / valued) : 0,
    renewalsNext30Cents,
    renewalsNext30Count,
    expiredActiveCount,
    withoutValue,
    excludedNames,
  }
}

function planKey(fact: DashboardFact): string {
  return `${fact.source_id ?? ''}:${fact.entity_kind}:${fact.plan?.trim().toLowerCase() ?? ''}`
}

function mostCommonAmountByPlan(facts: DashboardFact[]): Map<string, number> {
  const counts = new Map<string, Map<number, number>>()
  for (const fact of facts) {
    if (fact.amount_cents == null) continue
    const byAmount = counts.get(planKey(fact)) ?? new Map<number, number>()
    byAmount.set(fact.amount_cents, (byAmount.get(fact.amount_cents) ?? 0) + 1)
    counts.set(planKey(fact), byAmount)
  }

  const result = new Map<string, number>()
  for (const [plan, byAmount] of counts) {
    const [amount] = [...byAmount].sort((a, b) => b[1] - a[1] || b[0] - a[0])[0]
    result.set(plan, amount)
  }
  return result
}
