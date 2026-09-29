import { normalizeOrderSync } from './ordersync-adapter.ts'
import type { NormalizedSubscriptionFact, OrderSyncRecords } from './ordersync-types.ts'

export type SnapshotFact = {
  external_id: string
  entity_kind: 'individual' | 'organization'
  display_name: string | null
  plan: string | null
  status: string
  period_end_at: string | null
  trial_end_at: string | null
  cancel_at_period_end: boolean | null
  seat_count: number | null
  amount_cents: number | null
  currency: string | null
  provider: string | null
}

type Dependencies = {
  observedAt: string
  readRecords: () => Promise<OrderSyncRecords>
  replaceSnapshot: (facts: SnapshotFact[]) => Promise<number>
  recordFailure: (summary: string) => Promise<void>
}

export async function executeOrderSync(
  dependencies: Dependencies,
): Promise<{ status: 'succeeded'; factsWritten: number } | { status: 'failed' }> {
  try {
    const records = await dependencies.readRecords()
    const facts = normalizeOrderSync(records, dependencies.observedAt).map(toSnapshotFact)
    const factsWritten = await dependencies.replaceSnapshot(facts)

    return { status: 'succeeded', factsWritten }
  } catch (error) {
    await dependencies.recordFailure(errorSummary(error))
    return { status: 'failed' }
  }
}

function toSnapshotFact(fact: NormalizedSubscriptionFact): SnapshotFact {
  return {
    external_id: fact.externalId,
    entity_kind: fact.entityKind,
    display_name: fact.displayName,
    plan: fact.plan,
    status: fact.status,
    period_end_at: fact.periodEndAt,
    trial_end_at: fact.trialEndAt,
    cancel_at_period_end: fact.cancelAtPeriodEnd,
    seat_count: fact.seatCount,
    amount_cents: fact.amountCents,
    currency: fact.currency,
    provider: fact.provider,
  }
}

function errorSummary(error: unknown): string {
  if (error instanceof Error) {
    if (error.message.startsWith('ORDERSYNC_SOURCE_AUTH_FAILED')) {
      return 'OrdemSync reader authentication failed'
    }

    if (error.message.startsWith('ORDERSYNC_SOURCE_PERMISSION_FAILED')) {
      return 'OrdemSync reader lacks an approved read permission'
    }

    if (error.message.startsWith('ORDERSYNC_SOURCE_CONFIG_FAILED')) {
      return 'OrdemSync reader configuration is invalid'
    }

    if (error.message.startsWith('MONITORING_CENTRAL_WRITE_FAILED')) {
      return 'Central monitoring database write failed'
    }
  }

  return 'Unable to synchronize approved OrdemSync data'
}
