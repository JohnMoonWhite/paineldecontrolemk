import { fireEvent, render, screen, within } from '@testing-library/react'
import { describe, expect, it, vi } from 'vitest'
import { CompanyCashPanel } from './CompanyCashPanel'
import { parseAmountCents } from './ledger'
import type { LedgerSummary } from './ledger'

const summary: LedgerSummary = {
  month: { manualIncomeCents: 50000, systemIncomeCents: 4990, incomeCents: 54990, expenseCents: 15000, resultCents: 39990 },
  totals: { incomeCents: 159980, expenseCents: 17000, balanceCents: 142980 },
  movements: [
    { key: 'manual:e3', origin: 'manual', kind: 'income', date: '2026-09-20', amount_cents: 50000, entry: { id: 'e3', kind: 'income', amount_cents: 50000, entry_date: '2026-09-20', description: 'Projeto fazenda', category: 'Serviços', payment_method: 'pix', author_name: 'Clebson' } },
    { key: 'system:p2', origin: 'system', kind: 'income', date: '2026-09-05', amount_cents: 4990, payment: { source_id: 's1', reference: 'p2', external_id: 'c2', entity_kind: 'individual', method: 'pix', paid_at: '2026-09-05T15:00:00Z', amount_cents: 4990 } },
  ],
}

function renderPanel(overrides: Partial<Parameters<typeof CompanyCashPanel>[0]> = {}) {
  const props = {
    summary, month: '2026-09', onMonthChange: vi.fn(), customerName: () => 'JGH', sourceName: () => 'OrdemSync',
    onAdd: vi.fn().mockResolvedValue(undefined), onRemove: vi.fn().mockResolvedValue(undefined), onReport: vi.fn(), canEdit: true, ...overrides,
  }
  render(<CompanyCashPanel {...props} />)
  return props
}

describe('CompanyCashPanel', () => {
  it('shows the month, the accumulated totals and the current balance', () => {
    renderPanel()

    expect(within(screen.getByText('Entradas do mês').closest('article')!).getByText('R$ 549,90')).toBeVisible()
    expect(within(screen.getByText('Saídas do mês').closest('article')!).getByText('R$ 150,00')).toBeVisible()
    expect(within(screen.getByText('Resultado do mês').closest('article')!).getByText('R$ 399,90')).toBeVisible()
    expect(within(screen.getByText('Saldo atual').closest('article')!).getByText('R$ 1.429,80')).toBeVisible()
    expect(screen.getByText('Entradas acumuladas').nextSibling).toHaveTextContent('R$ 1.599,80')
    expect(screen.getByText('Saídas acumuladas').nextSibling).toHaveTextContent('R$ 170,00')
  })

  it('lists manual entries and system payments of the month', () => {
    renderPanel()

    expect(screen.getByText('Projeto fazenda')).toBeVisible()
    expect(screen.getByText('Assinatura JGH')).toBeVisible()
    expect(screen.getByText(/OrdemSync · PIX/)).toBeVisible()
  })

  it('records a new expense with the amount in reais', async () => {
    const { onAdd } = renderPanel()

    fireEvent.click(screen.getByRole('button', { name: '+ Novo lançamento' }))
    fireEvent.click(screen.getByRole('radio', { name: 'Saída' }))
    fireEvent.change(screen.getByLabelText('Descrição'), { target: { value: 'Hospedagem' } })
    fireEvent.change(screen.getByLabelText('Valor (R$)'), { target: { value: '1.234,56' } })
    fireEvent.change(screen.getByLabelText('Data'), { target: { value: '2026-09-28' } })
    fireEvent.click(screen.getByRole('button', { name: 'Lançar' }))

    await vi.waitFor(() => expect(onAdd).toHaveBeenCalledWith(expect.objectContaining({
      kind: 'expense', description: 'Hospedagem', amount_cents: 123456, entry_date: '2026-09-28',
    })))
  })
})

describe('parseAmountCents', () => {
  it('reads Brazilian and plain decimal amounts', () => {
    expect(parseAmountCents('1.234,56')).toBe(123456)
    expect(parseAmountCents('49,9')).toBe(4990)
    expect(parseAmountCents('239')).toBe(23900)
    expect(parseAmountCents('12.50')).toBe(1250)
    expect(parseAmountCents('abc')).toBeNull()
    expect(parseAmountCents('0')).toBeNull()
  })
})

describe('CompanyCashPanel access and outputs', () => {
  it('shows who recorded each manual entry', () => {
    renderPanel()

    expect(screen.getByText(/por Clebson/)).toBeVisible()
  })

  it('keeps read-only members from recording or removing entries', () => {
    renderPanel({ canEdit: false })

    expect(screen.queryByRole('button', { name: '+ Novo lançamento' })).not.toBeInTheDocument()
    expect(screen.queryByRole('button', { name: /Excluir/ })).not.toBeInTheDocument()
  })

  it('opens the monthly report and offers a CSV export', () => {
    const { onReport } = renderPanel()

    fireEvent.click(screen.getByRole('button', { name: 'Relatório do mês' }))
    expect(onReport).toHaveBeenCalledOnce()
    expect(screen.getByRole('button', { name: 'Exportar CSV' })).toBeVisible()
  })
})
