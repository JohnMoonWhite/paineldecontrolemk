import { fireEvent, render, screen, within } from '@testing-library/react'
import { describe, expect, it, vi } from 'vitest'
import { MonthlyReport } from './MonthlyReport'
import type { LedgerSummary } from './ledger'
import type { FinanceSummary } from './finance'

const cash: LedgerSummary = {
  month: { manualIncomeCents: 23900, systemIncomeCents: 4990, incomeCents: 28890, expenseCents: 18990, resultCents: 9900 },
  totals: { incomeCents: 528890, expenseCents: 18990, balanceCents: 509900 },
  movements: [{ key: 'manual:e1', origin: 'manual', kind: 'expense', date: '2026-09-28', amount_cents: 18990, entry: { id: 'e1', kind: 'expense', amount_cents: 18990, entry_date: '2026-09-28', description: 'Hospedagem', category: 'Infraestrutura', payment_method: 'credit_card', author_name: 'Matheus' } }],
}
const revenue = { payingCount: 12, monthlyCents: 81942, annualCents: 983304, averageTicketCents: 6829 } as FinanceSummary

describe('MonthlyReport', () => {
  it('summarizes the month for printing or saving as PDF', () => {
    const print = vi.spyOn(window, 'print').mockImplementation(() => {})
    const onClose = vi.fn()
    render(<MonthlyReport month="2026-09" cash={cash} revenue={revenue} describe={() => 'Hospedagem'} onClose={onClose} generatedAt={new Date('2026-10-02T12:00:00Z')} />)

    const sheet = screen.getByRole('dialog', { name: /Relatório de setembro de 2026/ })
    expect(within(sheet).getByText('R$ 288,90')).toBeVisible()
    expect(within(sheet).getByText('R$ 5.099,00')).toBeVisible()
    expect(within(sheet).getByText('R$ 819,42')).toBeVisible()
    expect(within(sheet).getByText('Hospedagem')).toBeVisible()

    fireEvent.click(screen.getByRole('button', { name: 'Imprimir ou salvar PDF' }))
    fireEvent.click(screen.getByRole('button', { name: 'Fechar' }))
    expect(print).toHaveBeenCalledOnce()
    expect(onClose).toHaveBeenCalledOnce()
  })
})
