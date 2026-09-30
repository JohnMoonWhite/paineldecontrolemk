import { Icon } from '../../components/Icon'
import type { FinanceSummary } from './finance'

const currency = new Intl.NumberFormat('pt-BR', { style: 'currency', currency: 'BRL' })
const money = (cents: number) => currency.format(cents / 100).replace(/\s/g, ' ')

export function FinancePanel({ summary, available }: { summary: FinanceSummary; available: boolean }) {
  const value = (cents: number) => available ? money(cents) : '—'
  const plural = (count: number, one: string, many: string) => `${count} ${count === 1 ? one : many}`

  return <section className="panel finance-panel" id="finance" aria-labelledby="finance-title">
    <div className="section-heading"><div><h2 id="finance-title">Resumo financeiro</h2><p>Receita das assinaturas ativas, sem contas internas</p></div><span className="count-label">{available ? plural(summary.payingCount, 'assinatura pagante', 'assinaturas pagantes') : '—'}</span></div>
    <div className="finance-grid">
      <FinanceMetric label="Receita mensal" value={value(summary.monthlyCents)} note="Soma das mensalidades vigentes" primary />
      <FinanceMetric label="Receita anual projetada" value={value(summary.annualCents)} note="Receita mensal × 12" />
      <FinanceMetric label="Ticket médio" value={value(summary.averageTicketCents)} note="Por assinatura com valor conhecido" />
      <FinanceMetric label="Renovações em 30 dias" value={value(summary.renewalsNext30Cents)} note={available ? plural(summary.renewalsNext30Count, 'assinatura vence', 'assinaturas vencem') + ' no período' : 'Assinaturas que vencem no período'} />
    </div>
    {available ? <ul className="finance-notes">
      <li>{money(summary.confirmedCents)} confirmados por pagamento{summary.estimatedCount ? ` · ${money(summary.estimatedCents)} de ${plural(summary.estimatedCount, 'assinatura estimada', 'assinaturas estimadas')} pelo valor do plano` : ''}.</li>
      {summary.withoutValue.length ? <li className="finance-notes__warning">Sem valor registrado, fora da soma: {summary.withoutValue.join(', ')}.</li> : null}
      {summary.expiredActiveCount ? <li className="finance-notes__warning">{plural(summary.expiredActiveCount, 'assinatura ativa está vencida', 'assinaturas ativas estão vencidas')} e ficou fora da receita.</li> : null}
    </ul> : null}
    <div className="panel-footnote"><Icon name="shield" /><span>{summary.excludedNames.length ? `Contas internas desconsideradas: ${summary.excludedNames.join(', ')}.` : 'Nenhuma conta interna cadastrada.'} Valores em reais, considerando cobrança mensal.</span></div>
  </section>
}

function FinanceMetric({ label, value, note, primary = false }: { label: string; value: string; note: string; primary?: boolean }) {
  return <article className={`finance-metric${primary ? ' finance-metric--primary' : ''}`}><span>{label}</span><strong>{value}</strong><small>{note}</small></article>
}
