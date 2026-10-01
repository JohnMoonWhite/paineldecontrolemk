import { describe, expect, it } from 'vitest'
import { summarizeLedger, type LedgerEntry, type SystemPayment } from './ledger'

const entries: LedgerEntry[] = [
  { id: 'e1', kind: 'income', amount_cents: 100000, entry_date: '2026-08-01', description: 'Saldo inicial', category: 'Saldo inicial', payment_method: null },
  { id: 'e2', kind: 'expense', amount_cents: 15000, entry_date: '2026-09-10', description: 'Servidor', category: 'Infraestrutura', payment_method: 'credit_card' },
  { id: 'e3', kind: 'income', amount_cents: 50000, entry_date: '2026-09-20', description: 'Projeto fazenda', category: 'Serviços', payment_method: 'pix' },
  { id: 'e4', kind: 'expense', amount_cents: 2000, entry_date: '2026-10-02', description: 'Domínio', category: 'Infraestrutura', payment_method: 'pix' },
]

const payments: SystemPayment[] = [
  { source_id: 's1', reference: 'p1', external_id: 'c1', entity_kind: 'individual', method: 'pix', paid_at: '2026-08-15T15:00:00Z', amount_cents: 4990 },
  { source_id: 's1', reference: 'p2', external_id: 'c2', entity_kind: 'individual', method: 'pix', paid_at: '2026-09-05T15:00:00Z', amount_cents: 4990 },
  { source_id: 's1', reference: 'p3', external_id: 'mkhub', entity_kind: 'organization', method: 'pix', paid_at: '2026-09-06T15:00:00Z', amount_cents: 23900 },
]

const exclusions = [{ source_id: 's1', external_id: 'mkhub', entity_kind: 'organization' }]

describe('summarizeLedger', () => {
  it('adds manual entries and system payments of the chosen month', () => {
    const summary = summarizeLedger({ entries, payments, exclusions, month: '2026-09', today: '2026-10-05' })

    expect(summary.month).toEqual({
      manualIncomeCents: 50000,
      systemIncomeCents: 4990,
      incomeCents: 54990,
      expenseCents: 15000,
      resultCents: 39990,
    })
  })

  it('keeps all-time totals and the current balance, without internal accounts', () => {
    const summary = summarizeLedger({ entries, payments, exclusions, month: '2026-09', today: '2026-10-05' })

    expect(summary.totals).toEqual({ incomeCents: 159980, expenseCents: 17000, balanceCents: 142980 })
  })

  it('leaves future-dated entries out of the current balance', () => {
    const summary = summarizeLedger({ entries, payments, exclusions, month: '2026-09', today: '2026-09-30' })

    expect(summary.totals.expenseCents).toBe(15000)
  })

  it('lists the month movements newest first, with system payments marked as such', () => {
    const summary = summarizeLedger({ entries, payments, exclusions, month: '2026-09', today: '2026-10-05' })

    expect(summary.movements.map(item => [item.origin, item.kind, item.amount_cents])).toEqual([
      ['manual', 'income', 50000],
      ['manual', 'expense', 15000],
      ['system', 'income', 4990],
    ])
  })
})
