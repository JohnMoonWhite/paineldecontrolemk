import { useState, type FormEvent } from 'react'
import { downloadCsv, toCsv } from '../../lib/csv'
import { formatDay, money, monthLabel, plainAmount } from '../../lib/format'
import { parseAmountCents, type LedgerEntry, type LedgerMovement, type LedgerSummary } from './ledger'
import { paymentMethodLabel } from './relationship'

export type NewLedgerEntry = Omit<LedgerEntry, 'id' | 'author_name'>

const ledgerCategories = ['Saldo inicial', 'Serviços', 'Contratos', 'Infraestrutura', 'Ferramentas', 'Impostos', 'Pessoal', 'Marketing', 'Outros']
const paymentMethods = [['pix', 'PIX'], ['credit_card', 'Cartão de crédito'], ['debit_card', 'Cartão de débito'], ['boleto', 'Boleto'], ['bank_transfer', 'Transferência'], ['cash', 'Dinheiro'], ['mercadopago', 'Mercado Pago'], ['stripe', 'Cartão (Stripe)'], ['other', 'Outro']] as const
const methodLabels: Record<string, string> = Object.fromEntries(paymentMethods)

export function CompanyCashPanel({ summary, month, onMonthChange, customerName, sourceName, onAdd, onRemove, onReport, canEdit = true }: {
  summary: LedgerSummary
  month: string
  onMonthChange: (month: string) => void
  customerName: (movement: LedgerMovement) => string
  sourceName: (movement: LedgerMovement) => string
  onAdd: (entry: NewLedgerEntry) => Promise<void>
  onRemove: (entryId: string) => Promise<void>
  onReport: () => void
  /** Read-only members see the cash panel without the entry form or delete buttons. */
  canEdit?: boolean
}) {
  const [kind, setKind] = useState<'income' | 'expense'>('income')
  const [description, setDescription] = useState('')
  const [amount, setAmount] = useState('')
  const [date, setDate] = useState(() => new Date().toLocaleDateString('en-CA'))
  const [category, setCategory] = useState('')
  const [method, setMethod] = useState('pix')
  const [saving, setSaving] = useState(false)
  const [formOpen, setFormOpen] = useState(false)
  const [formError, setFormError] = useState<string | null>(null)

  async function submit(event: FormEvent) {
    event.preventDefault()
    const amountCents = parseAmountCents(amount)
    if (!description.trim()) { setFormError('Informe uma descrição.'); return }
    if (amountCents === null) { setFormError('Informe um valor maior que zero, por exemplo 1.234,56.'); return }
    if (!date) { setFormError('Informe a data.'); return }
    setSaving(true); setFormError(null)
    try {
      await onAdd({ kind, description: description.trim(), amount_cents: amountCents, entry_date: date, category: category.trim() || null, payment_method: method })
      setDescription(''); setAmount(''); setCategory(''); setFormOpen(false)
    } catch (cause) {
      setFormError(cause instanceof Error ? cause.message : 'Não foi possível salvar o lançamento.')
    } finally {
      setSaving(false)
    }
  }

  const { month: current, totals } = summary
  const describeMovement = (item: LedgerMovement) => item.entry ? item.entry.description : `Assinatura ${customerName(item)}`
  const originOf = (item: LedgerMovement) => item.entry
    ? `Manual · ${methodLabels[item.entry.payment_method ?? ''] ?? 'Não informado'}`
    : `${sourceName(item)} · ${paymentMethodLabel(item.payment?.method)}`

  function exportCsv() {
    const rows = summary.movements.map(item => [
      formatDay(item.date), item.kind === 'income' ? 'Entrada' : 'Saída', describeMovement(item), item.entry?.category ?? '',
      originOf(item), item.entry?.author_name ?? (item.entry ? '' : 'Automático'), plainAmount(item.kind === 'expense' ? -item.amount_cents : item.amount_cents),
    ])
    downloadCsv(`caixa-${month}.csv`, toCsv(['Data', 'Tipo', 'Descrição', 'Categoria', 'Origem', 'Lançado por', 'Valor'], rows))
  }
  const flowTotal = current.incomeCents + current.expenseCents
  const incomeShare = flowTotal ? Math.round(current.incomeCents / flowTotal * 100) : 0
  return <section className="panel cash-panel" id="cash" aria-labelledby="cash-title">
    <div className="cash-head">
      <div><h2 id="cash-title">Caixa da empresa</h2><p>Lançamentos manuais e pagamentos recebidos pelos sistemas</p></div>
      <div className="cash-actions">
        <label className="month-picker"><span>Mês</span><input type="month" value={month} onChange={event => event.target.value && onMonthChange(event.target.value)} /></label>
        <button className="secondary-button" type="button" onClick={onReport}>Relatório do mês</button>
        <button className="secondary-button" type="button" onClick={exportCsv} disabled={!summary.movements.length}>Exportar CSV</button>
        {canEdit ? <button className="primary-button" type="button" aria-expanded={formOpen} aria-controls="cash-form" onClick={() => setFormOpen(open => !open)}>{formOpen ? 'Fechar' : '+ Novo lançamento'}</button> : null}
      </div>
    </div>
    <div className="cash-overview">
      <article className={`cash-balance${totals.balanceCents < 0 ? ' cash-balance--negative' : ''}`}>
        <span>Saldo atual</span>
        <strong>{money(totals.balanceCents)}</strong>
        <dl className="cash-totals">
          <div><dt>Entradas acumuladas</dt><dd>{money(totals.incomeCents)}</dd></div>
          <div><dt>Saídas acumuladas</dt><dd>{money(totals.expenseCents)}</dd></div>
        </dl>
      </article>
      <div className="cash-month">
        <p className="cash-month-label">Movimento de {monthLabel(month)}</p>
        <div className="cash-month-grid">
          <CashMetric label="Entradas do mês" value={money(current.incomeCents)} note={`${money(current.systemIncomeCents)} dos sistemas · ${money(current.manualIncomeCents)} manuais`} tone="income" />
          <CashMetric label="Saídas do mês" value={money(current.expenseCents)} note="Despesas lançadas" tone="expense" />
          <CashMetric label="Resultado do mês" value={money(current.resultCents)} note="Entradas − saídas" tone={current.resultCents < 0 ? 'expense' : 'neutral'} />
        </div>
        <div className="cash-flow" aria-hidden="true">{flowTotal ? <><span style={{ width: `${incomeShare}%` }} /><span style={{ width: `${100 - incomeShare}%` }} /></> : null}</div>
      </div>
    </div>
    {canEdit && formOpen ? <form className="cash-form" id="cash-form" onSubmit={event => void submit(event)} aria-label="Novo lançamento">
      <fieldset className="kind-toggle"><legend>Tipo</legend>
        <label><input type="radio" name="kind" checked={kind === 'income'} onChange={() => setKind('income')} />Entrada</label>
        <label><input type="radio" name="kind" checked={kind === 'expense'} onChange={() => setKind('expense')} />Saída</label>
      </fieldset>
      <label className="cash-form__wide">Descrição<input value={description} onChange={event => setDescription(event.target.value)} placeholder="Ex.: Hospedagem, contrato fazenda" /></label>
      <label>Valor (R$)<input inputMode="decimal" value={amount} onChange={event => setAmount(event.target.value)} placeholder="0,00" /></label>
      <label>Data<input type="date" value={date} onChange={event => setDate(event.target.value)} /></label>
      <label>Categoria<input list="ledger-categories" value={category} onChange={event => setCategory(event.target.value)} placeholder="Ex.: Infraestrutura" /><datalist id="ledger-categories">{ledgerCategories.map(item => <option key={item} value={item} />)}</datalist></label>
      <label>Forma<select value={method} onChange={event => setMethod(event.target.value)}>{paymentMethods.map(([value, label]) => <option key={value} value={value}>{label}</option>)}</select></label>
      <button className="primary-button" disabled={saving} type="submit">{saving ? 'Salvando…' : 'Lançar'}</button>
      {formError ? <p className="form-error" role="alert">{formError}</p> : null}
    </form> : null}
    {summary.movements.length ? <ol className="cash-list" aria-label={`Movimentações de ${monthLabel(month)}`}>{summary.movements.map(item => {
      const [, monthPart, day] = item.date.split('-')
      return <li key={item.key} className={`cash-item cash-item--${item.kind}`}>
        <time className="cash-date" dateTime={item.date}><b>{day}</b>{shortMonths[Number(monthPart) - 1]}</time>
        <div className="cash-item__body">
          {item.entry ? <><strong>{item.entry.description}</strong><span>{[item.entry.category, originOf(item), item.entry.author_name ? `por ${item.entry.author_name}` : null].filter(Boolean).join(' · ')}</span></>
            : <><strong>Assinatura {customerName(item)}</strong><span>{sourceName(item)} · {paymentMethodLabel(item.payment?.method)} · automático</span></>}
        </div>
        <span className="cash-amount">{item.kind === 'expense' ? '−' : '+'} {money(item.amount_cents)}</span>
        {item.entry && canEdit ? <button className="cash-remove" type="button" aria-label={`Excluir ${item.entry.description}`} title="Excluir lançamento" onClick={() => { if (window.confirm(`Excluir o lançamento "${item.entry!.description}"?`)) void onRemove(item.entry!.id) }}>×</button> : <span className="cash-remove" aria-hidden="true" />}
      </li>
    })}</ol> : <div className="empty-state"><p>Nenhuma movimentação em {monthLabel(month)}.</p></div>}
    <p className="table-note">O saldo atual soma tudo o que entrou menos tudo o que saiu até hoje. Para ele bater com a conta bancária, lance um "Saldo inicial" com o valor em caixa antes do primeiro lançamento.</p>
  </section>
}

const shortMonths = ['jan', 'fev', 'mar', 'abr', 'mai', 'jun', 'jul', 'ago', 'set', 'out', 'nov', 'dez']

function CashMetric({ label, value, note, tone }: { label: string; value: string; note: string; tone: 'income' | 'expense' | 'neutral' }) {
  return <article className={`cash-metric cash-metric--${tone}`}><span>{label}</span><strong>{value}</strong><small>{note}</small></article>
}
