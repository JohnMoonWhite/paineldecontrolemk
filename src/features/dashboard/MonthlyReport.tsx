import { formatDay, money, monthLabel } from '../../lib/format'
import type { FinanceSummary } from './finance'
import type { LedgerMovement, LedgerSummary } from './ledger'

/** Printable monthly closing: cash, recurring revenue and every movement of the month. */
export function MonthlyReport({ month, cash, revenue, describe, onClose, generatedAt }: {
  month: string
  cash: LedgerSummary
  revenue: FinanceSummary
  describe: (movement: LedgerMovement) => string
  onClose: () => void
  generatedAt: Date
}) {
  const title = `Relatório de ${monthLabel(month)}`
  return <div className="report-backdrop">
    <article className="report-sheet" role="dialog" aria-modal="true" aria-label={title}>
      <header className="report-head">
        <img src="/brand/mkhub-lockup.png" alt="MKHub" width="699" height="96" />
        <div><h2>{title}</h2><p>Gerado em {generatedAt.toLocaleString('pt-BR', { dateStyle: 'short', timeStyle: 'short' })}</p></div>
      </header>
      <h3>Caixa</h3>
      <dl className="report-figures">
        <div><dt>Entradas do mês</dt><dd>{money(cash.month.incomeCents)}</dd><small>{money(cash.month.systemIncomeCents)} dos sistemas · {money(cash.month.manualIncomeCents)} manuais</small></div>
        <div><dt>Saídas do mês</dt><dd>{money(cash.month.expenseCents)}</dd></div>
        <div><dt>Resultado do mês</dt><dd>{money(cash.month.resultCents)}</dd></div>
        <div><dt>Saldo atual</dt><dd>{money(cash.totals.balanceCents)}</dd></div>
      </dl>
      <h3>Receita recorrente</h3>
      <dl className="report-figures">
        <div><dt>Receita mensal</dt><dd>{money(revenue.monthlyCents)}</dd></div>
        <div><dt>Receita anual projetada</dt><dd>{money(revenue.annualCents)}</dd></div>
        <div><dt>Assinaturas pagantes</dt><dd>{revenue.payingCount}</dd></div>
        <div><dt>Ticket médio</dt><dd>{money(revenue.averageTicketCents)}</dd></div>
      </dl>
      <h3>Movimentações</h3>
      {cash.movements.length ? <table className="report-table"><thead><tr><th>Data</th><th>Descrição</th><th>Origem</th><th>Valor</th></tr></thead><tbody>{cash.movements.map(item => <tr key={item.key}>
        <td>{formatDay(item.date)}</td>
        <td>{describe(item)}</td>
        <td>{item.entry ? `Manual${item.entry.author_name ? ` · ${item.entry.author_name}` : ''}` : 'Sistema'}</td>
        <td>{item.kind === 'expense' ? '− ' : ''}{money(item.amount_cents)}</td>
      </tr>)}</tbody></table> : <p>Nenhuma movimentação no mês.</p>}
      <footer className="report-actions">
        <button className="primary-button" type="button" onClick={() => window.print()}>Imprimir ou salvar PDF</button>
        <button className="secondary-button" type="button" onClick={onClose}>Fechar</button>
      </footer>
    </article>
  </div>
}
