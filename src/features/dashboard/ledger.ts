import type { FinanceExclusion } from './finance'

/** A manual entry recorded by the team. */
export type LedgerEntry = {
  id: string
  kind: 'income' | 'expense'
  amount_cents: number
  entry_date: string
  description: string
  category: string | null
  payment_method: string | null
  /** Stamped by the database with the name of whoever recorded the entry. */
  author_name?: string | null
}

/** A payment received by a monitored system. */
export type SystemPayment = {
  source_id: string
  reference: string
  external_id: string
  entity_kind: string
  method: string
  paid_at: string
  amount_cents: number
}

export type LedgerMovement = {
  key: string
  origin: 'manual' | 'system'
  kind: 'income' | 'expense'
  date: string
  amount_cents: number
  entry?: LedgerEntry
  payment?: SystemPayment
}

export type LedgerSummary = {
  month: { manualIncomeCents: number; systemIncomeCents: number; incomeCents: number; expenseCents: number; resultCents: number }
  totals: { incomeCents: number; expenseCents: number; balanceCents: number }
  movements: LedgerMovement[]
}

// Business dates follow the company's time zone, whatever the viewer's browser uses.
const businessDate = new Intl.DateTimeFormat('en-CA', { timeZone: 'America/Sao_Paulo', year: 'numeric', month: '2-digit', day: '2-digit' })

export function toBusinessDate(value: string | Date): string {
  return businessDate.format(typeof value === 'string' ? new Date(value) : value)
}

/** Reads "1.234,56", "49,9", "239" or "12.50" as cents; null when it is not a positive amount. */
export function parseAmountCents(value: string): number | null {
  let text = value.trim().replace(/\s|R\$/g, '')
  if (text.includes(',')) text = text.replace(/\./g, '').replace(',', '.')
  else if (/\.\d{3}$/.test(text)) text = text.replace(/\./g, '')
  const amount = Number(text)
  return Number.isFinite(amount) && amount > 0 ? Math.round(amount * 100) : null
}

const exclusionKey = (item: { source_id?: string; external_id: string; entity_kind: string }) =>
  `${item.source_id ?? ''}:${item.entity_kind}:${item.external_id}`

/** Cash view: manual entries plus payments received by the systems, for one month and all time. */
export function summarizeLedger({ entries, payments, exclusions, month, today }: {
  entries: LedgerEntry[]
  payments: SystemPayment[]
  exclusions: FinanceExclusion[]
  month: string
  today: string
}): LedgerSummary {
  const excluded = new Set(exclusions.map(exclusionKey))
  const movements: LedgerMovement[] = [
    ...entries.map(entry => ({ key: 'manual:' + entry.id, origin: 'manual' as const, kind: entry.kind, date: entry.entry_date, amount_cents: entry.amount_cents, entry })),
    ...payments
      .filter(payment => !excluded.has(exclusionKey(payment)))
      .map(payment => ({ key: 'system:' + payment.reference, origin: 'system' as const, kind: 'income' as const, date: toBusinessDate(payment.paid_at), amount_cents: payment.amount_cents, payment })),
  ]

  const monthMovements = movements.filter(item => item.date.startsWith(month))
  const sum = (items: LedgerMovement[]) => items.reduce((total, item) => total + item.amount_cents, 0)
  const manualIncomeCents = sum(monthMovements.filter(item => item.origin === 'manual' && item.kind === 'income'))
  const systemIncomeCents = sum(monthMovements.filter(item => item.origin === 'system'))
  const expenseCents = sum(monthMovements.filter(item => item.kind === 'expense'))

  const untilToday = movements.filter(item => item.date <= today)
  const totalIncome = sum(untilToday.filter(item => item.kind === 'income'))
  const totalExpense = sum(untilToday.filter(item => item.kind === 'expense'))

  return {
    month: {
      manualIncomeCents,
      systemIncomeCents,
      incomeCents: manualIncomeCents + systemIncomeCents,
      expenseCents,
      resultCents: manualIncomeCents + systemIncomeCents - expenseCents,
    },
    totals: { incomeCents: totalIncome, expenseCents: totalExpense, balanceCents: totalIncome - totalExpense },
    movements: monthMovements.sort((a, b) => b.date.localeCompare(a.date) || a.origin.localeCompare(b.origin)),
  }
}
