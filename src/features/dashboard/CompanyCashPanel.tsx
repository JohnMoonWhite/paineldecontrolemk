import { useState, type FormEvent } from 'react'
import { parseAmountCents, type LedgerEntry, type LedgerMovement, type LedgerSummary } from './ledger'
import { paymentMethodLabel } from './relationship'

export type NewLedgerEntry = Omit<LedgerEntry, 'id'>

const currency = new Intl.NumberFormat('pt-BR', { style: 'currency', currency: 'BRL' })
const money = (cents: number) => currency.format(cents / 100).replace(/\s/g, ' ')

const ledgerCategories = ['Saldo inicial', 'Serviços', 'Contratos', 'Infraestrutura', 'Ferramentas', 'Impostos', 'Pessoal', 'Marketing', 'Outros']
const paymentMethods = [['pix', 'PIX'], ['credit_card', 'Cartão de crédito'], ['debit_card', 'Cartão de débito'], ['boleto', 'Boleto'], ['bank_transfer', 'Transferência'], ['cash', 'Dinheiro'], ['mercadopago', 'Mercado Pago'], ['stripe', 'Cartão (Stripe)'], ['other', 'Outro']] as const
const methodLabels: Record<string, string> = Object.fromEntries(paymentMethods)

function formatDay(date: string) {
  const [year, month, day] = date.split('-')
  return `${day}/${month}/${year}`
}

export function CompanyCashPanel({ summary, month, onMonthChange, customerName, sourceName, onAdd, onRemove }: {
  summary: LedgerSummary
  month: string
  onMonthChange: (month: string) => void
  customerName: (movement: LedgerMovement) => string
  sourceName: (movement: LedgerMovement) => string
  onAdd: (entry: NewLedgerEntry) => Promise<void>
  onRemove: (entryId: string) => Promise<void>
}) {
  const [kind, setKind] = useState<'income' | 'expense'>('income')
  const [description, setDescription] = useState('')
  const [amount, setAmount] = useState('')
  const [date, setDate] = useState(() => new Date().toLocaleDateString('en-CA'))
  const [category, setCategory] = useState('')
  const [method, setMethod] = useState('pix')
  const [saving, setSaving] = useState(false)
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
      setDescription(''); setAmount(''); setCategory('')
    } catch (cause) {
      setFormError(cause instanceof Error ? cause.message : 'Não foi possível salvar o lançamento.')
    } finally {
      setSaving(false)
    }
  }

  const { month: current, totals } = summary
  return <section className="panel cash-panel" id="cash" aria-labelledby="cash-title">
    <div className="section-heading"><div><h2 id="cash-title">Caixa da empresa</h2><p>Lançamentos manuais e pagamentos recebidos pelos sistemas</p></div><label className="month-picker"><span>Mês</span><input type="month" value={month} onChange={event => event.target.value && onMonthChange(event.target.value)} /></label></div>
    <div className="finance-grid">
      <CashMetric label="Entradas do mês" value={money(current.incomeCents)} note={`${money(current.systemIncomeCents)} dos sistemas · ${money(current.manualIncomeCents)} manuais`} tone="income" />
      <CashMetric label="Saídas do mês" value={money(current.expenseCents)} note="Lançamentos de despesa" tone="expense" />
      <CashMetric label="Resultado do mês" value={money(current.resultCents)} note="Entradas − saídas" tone={current.resultCents < 0 ? 'expense' : 'income'} />
      <CashMetric label="Saldo atual" value={money(totals.balanceCents)} note={`Acumulado: ${money(totals.incomeCents)} em entradas · ${money(totals.expenseCents)} em saídas`} tone={totals.balanceCents < 0 ? 'expense' : 'primary'} />
    </div>
    <form className="cash-form" onSubmit={event => void submit(event)} aria-label="Novo lançamento">
      <fieldset className="kind-toggle"><legend>Tipo</legend>
        <label><input type="radio" name="kind" checked={kind === 'income'} onChange={() => setKind('income')} />Entrada</label>
        <label><input type="radio" name="kind" checked={kind === 'expense'} onChange={() => setKind('expense')} />Saída</label>
      </fieldset>
      <label>Descrição<input value={description} onChange={event => setDescription(event.target.value)} placeholder="Ex.: Hospedagem, contrato fazenda" /></label>
      <label>Valor (R$)<input inputMode="decimal" value={amount} onChange={event => setAmount(event.target.value)} placeholder="0,00" /></label>
      <label>Data<input type="date" value={date} onChange={event => setDate(event.target.value)} /></label>
      <label>Categoria<input list="ledger-categories" value={category} onChange={event => setCategory(event.target.value)} placeholder="Ex.: Infraestrutura" /><datalist id="ledger-categories">{ledgerCategories.map(item => <option key={item} value={item} />)}</datalist></label>
      <label>Forma<select value={method} onChange={event => setMethod(event.target.value)}>{paymentMethods.map(([value, label]) => <option key={value} value={value}>{label}</option>)}</select></label>
      <button className="secondary-button" disabled={saving} type="submit">{saving ? 'Salvando…' : 'Lançar'}</button>
      {formError ? <p className="form-error" role="alert">{formError}</p> : null}
    </form>
    {summary.movements.length ? <div className="table-scroll"><table className="cash-table"><thead><tr><th>Data</th><th>Descrição</th><th>Origem</th><th>Valor</th><th><span className="visually-hidden">Ações</span></th></tr></thead><tbody>{summary.movements.map(item => {
      const signed = `${item.kind === 'expense' ? '− ' : '+ '}${money(item.amount_cents)}`
      return <tr key={item.key}>
        <td>{formatDay(item.date)}</td>
        <td>{item.entry ? <><strong>{item.entry.description}</strong>{item.entry.category ? <span className="table-secondary">{item.entry.category}</span> : null}</> : <><strong>Assinatura {customerName(item)}</strong><span className="table-secondary">Pagamento recebido automaticamente</span></>}</td>
        <td>{item.entry ? `Manual · ${methodLabels[item.entry.payment_method ?? ''] ?? 'Não informado'}` : `${sourceName(item)} · ${paymentMethodLabel(item.payment?.method)}`}</td>
        <td className={item.kind === 'expense' ? 'amount-expense' : 'amount-income'}>{signed}</td>
        <td>{item.entry ? <button className="text-button" type="button" onClick={() => { if (window.confirm(`Excluir o lançamento "${item.entry!.description}"?`)) void onRemove(item.entry!.id) }}>Excluir</button> : null}</td>
      </tr>
    })}</tbody></table></div> : <div className="empty-state"><p>Nenhuma movimentação neste mês.</p></div>}
    <p className="table-note">O saldo atual soma tudo o que entrou menos tudo o que saiu até hoje. Para ele bater com a conta bancária, lance um "Saldo inicial" com o valor em caixa antes do primeiro lançamento.</p>
  </section>
}

function CashMetric({ label, value, note, tone }: { label: string; value: string; note: string; tone: 'income' | 'expense' | 'primary' }) {
  return <article className={`finance-metric cash-metric--${tone}`}><span>{label}</span><strong>{value}</strong><small>{note}</small></article>
}
