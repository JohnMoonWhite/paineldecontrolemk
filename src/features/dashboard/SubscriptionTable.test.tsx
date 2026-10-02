import { fireEvent, render, screen, within } from '@testing-library/react'
import { describe, expect, it } from 'vitest'
import type { DashboardFact } from './dashboard-query'
import { SubscriptionTable } from './SubscriptionTable'

const now = new Date('2026-09-30T12:00:00Z')
const sources = [{ id: 's1', code: 'ordersync', name: 'OrdemSync', status: 'healthy', last_success_at: '2026-09-30T11:59:00Z' }]
const base = { source_id: 's1', entity_kind: 'individual' as const, plan: 'pro', trial_end_at: null, seat_count: null, provider: null }
const facts: DashboardFact[] = [
  { ...base, external_id: 'a', display_name: 'Cliente Pix', status: 'active', period_end_at: '2026-10-30T00:00:00Z', payment_method: 'pix', payments_count: 3, first_paid_at: '2026-07-15T12:00:00Z' },
  { ...base, external_id: 'b', display_name: 'Ex Cliente', status: 'active', period_end_at: '2026-09-01T00:00:00Z', payment_method: 'stripe', payments_count: 0 },
  { ...base, external_id: 'c', display_name: 'Teste Acabou', plan: 'gratuito', status: 'trialing', period_end_at: null, trial_end_at: '2026-07-26T00:00:00Z' },
]

describe('SubscriptionTable', () => {
  it('shows each customer relationship, when it expired and how they pay', () => {
    render(<SubscriptionTable facts={facts} sources={sources} now={now} />)

    const pix = screen.getByText('Cliente Pix').closest('tr')!
    expect(within(pix).getByText('Assinante ativo')).toBeVisible()
    expect(within(pix).getByText('PIX')).toBeVisible()
    expect(within(pix).getByText(/3 pagamentos · cliente desde 07\/2026/)).toBeVisible()

    const former = screen.getByText('Ex Cliente').closest('tr')!
    expect(within(former).getByText('Ex-assinante')).toBeVisible()
    expect(within(former).getByText('Cartão (Stripe)')).toBeVisible()
    expect(within(former).getByText(/expirou há 29 dias/)).toBeVisible()

    expect(within(screen.getByText('Teste Acabou').closest('tr')!).getByText('Teste expirado')).toBeVisible()
  })

  it('filters by relationship and by payment method', () => {
    render(<SubscriptionTable facts={facts} sources={sources} now={now} />)

    fireEvent.change(screen.getByLabelText('Situação'), { target: { value: 'former' } })
    expect(screen.getByText('Ex Cliente')).toBeVisible()
    expect(screen.queryByText('Cliente Pix')).not.toBeInTheDocument()

    fireEvent.change(screen.getByLabelText('Situação'), { target: { value: 'all' } })
    fireEvent.change(screen.getByLabelText('Pagamento'), { target: { value: 'pix' } })
    expect(screen.getByText('Cliente Pix')).toBeVisible()
    expect(screen.queryByText('Ex Cliente')).not.toBeInTheDocument()
  })

  it('tags active subscriptions that expire within seven days', () => {
    const soon = { ...base, external_id: 'soon', display_name: 'Vence Logo', status: 'active', period_end_at: '2026-10-04T12:00:00Z', payment_method: 'pix', payments_count: 1 }
    render(<SubscriptionTable facts={[...facts, soon]} sources={sources} now={now} />)

    expect(within(screen.getByText('Vence Logo').closest('tr')!).getByText('Vence em breve')).toBeVisible()
    expect(within(screen.getByText('Cliente Pix').closest('tr')!).queryByText('Vence em breve')).not.toBeInTheDocument()
    expect(within(screen.getByText('Ex Cliente').closest('tr')!).queryByText('Vence em breve')).not.toBeInTheDocument()
  })
})
