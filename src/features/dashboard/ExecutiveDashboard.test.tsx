import { render, screen, within } from '@testing-library/react'
import { describe, expect, it } from 'vitest'
import { SubscriptionHealth } from './SubscriptionHealth'
import { DashboardView } from './ExecutiveDashboard'

describe('SubscriptionHealth', () => {
  it('shows a useful zero-data state without suggesting source data is missing from the browser', () => {
    render(<SubscriptionHealth health={{ valid: 0, expiringSoon: 0, expiredOrInconsistent: 0, withoutExpiry: 0, individuals: 0, organizations: 0 }} />)

    expect(screen.getByText('Ainda não há uma fotografia para exibir.')).toBeVisible()
    expect(screen.queryByText(/email/i)).not.toBeInTheDocument()
  })
})

describe('DashboardView', () => {
  it('leaves internal accounts out of the subscription health totals', () => {
    const now = new Date('2026-09-30T12:00:00Z')
    const base = { source_id: 's1', plan: 'pro', status: 'active', trial_end_at: null, seat_count: null, provider: 'mercadopago', amount_cents: 4990, currency: null }
    const snapshot = {
      sources: [{ id: 's1', code: 'ordersync', name: 'OrdemSync', status: 'active', last_success_at: '2026-09-30T11:59:00Z' }],
      facts: [
        { ...base, external_id: 'cliente', entity_kind: 'individual' as const, display_name: 'JGH', period_end_at: '2026-10-30T09:43:13Z' },
        { ...base, external_id: 'mkhub', entity_kind: 'organization' as const, display_name: 'MKHUB', plan: 'empresas', period_end_at: '2027-07-01T22:23:00Z' },
      ],
      exclusions: [{ source_id: 's1', external_id: 'mkhub', entity_kind: 'organization' }],
    }
    render(<DashboardView snapshot={snapshot} error={null} refreshing={false} syncing={false} updatedAt={now} now={now} refresh={async () => {}} syncNow={async () => {}} onSignOut={() => {}} />)

    const valid = screen.getByText('Assinaturas válidas').closest('article')!
    expect(within(valid).getByText('1')).toBeVisible()
  })
})
