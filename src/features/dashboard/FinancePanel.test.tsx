import { render, screen } from '@testing-library/react'
import { describe, expect, it } from 'vitest'
import { FinancePanel } from './FinancePanel'
import type { FinanceSummary } from './finance'

const summary: FinanceSummary = {
  payingCount: 10, monthlyCents: 49900, confirmedCents: 34930, estimatedCents: 14970, estimatedCount: 3,
  annualCents: 598800, averageTicketCents: 4990, renewalsNext30Cents: 29940, renewalsNext30Count: 6,
  expiredActiveCount: 0, withoutValue: ['AGRODII'], excludedNames: ['MKHUB', 'Clebson - GESTOR TESTE'],
}

describe('FinancePanel', () => {
  it('shows monthly revenue, how it was composed and what was left out', () => {
    render(<FinancePanel summary={summary} available />)

    expect(screen.getByText('R$ 499,00')).toBeVisible()
    expect(screen.getByText(/3 assinaturas estimadas pelo valor do plano/)).toBeVisible()
    expect(screen.getByText(/AGRODII/)).toBeVisible()
    expect(screen.getByText(/MKHUB, Clebson - GESTOR TESTE/)).toBeVisible()
  })

  it('shows placeholders before the first collection', () => {
    render(<FinancePanel summary={summary} available={false} />)

    expect(screen.queryByText('R$ 499,00')).not.toBeInTheDocument()
  })
})
