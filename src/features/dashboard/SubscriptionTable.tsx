import { useState } from 'react'
import { Icon } from '../../components/Icon'
import { downloadCsv, toCsv } from '../../lib/csv'
import { effectiveExpiry, factState, type DashboardFact } from './dashboard-query'
import type { Source } from './dashboard-data'
import { paymentMethodLabel, relationship, relationshipLabels, type Relationship } from './relationship'

const relationshipBadges: Record<Relationship, string> = {
  subscriber: 'valid', cancelling: 'expiring', overdue: 'expired', trial: 'no-expiry',
  'trial-expired': 'neutral', free: 'neutral', former: 'expired', inactive: 'neutral',
}

const paymentFilters = [['pix', 'PIX'], ['stripe', 'Cartão (Stripe)'], ['mercadopago', 'Mercado Pago'], ['none', 'Não informado']] as const

function formatDate(value: string | null) {
  if (!value) return 'Não informada'
  const date = new Date(value)
  return Number.isFinite(date.getTime()) ? date.toLocaleDateString('pt-BR') : 'Data inválida'
}

/** An active subscription whose due date falls within the next seven days. */
function expiresSoon(fact: DashboardFact, now: Date) {
  const state = relationship(fact, now)
  return (state === 'subscriber' || state === 'cancelling') && factState(fact, now) === 'expiring'
}

function relativeExpiry(value: string | null, now: Date): string | null {
  const time = value ? Date.parse(value) : NaN
  if (!Number.isFinite(time)) return null
  const days = Math.floor(Math.abs(time - now.getTime()) / 86400000)
  const span = days === 0 ? 'hoje' : `${days} ${days === 1 ? 'dia' : 'dias'}`
  if (time <= now.getTime()) return days === 0 ? 'expirou hoje' : `expirou há ${span}`
  return days === 0 ? 'vence hoje' : `vence em ${span}`
}

function paymentHistory(fact: DashboardFact): string | null {
  const count = fact.payments_count ?? 0
  if (count > 0) {
    const since = fact.first_paid_at ? new Date(fact.first_paid_at).toLocaleDateString('pt-BR', { month: '2-digit', year: 'numeric' }) : null
    return `${count} ${count === 1 ? 'pagamento' : 'pagamentos'}${since ? ` · cliente desde ${since}` : ''}`
  }
  return fact.payment_method === 'stripe' ? 'Cobrança recorrente no cartão' : null
}

export function SubscriptionTable({ facts, sources, now }: { facts: DashboardFact[]; sources: Source[]; now: Date }) {
  const [search, setSearch] = useState('')
  const [filter, setFilter] = useState('all')
  const [payment, setPayment] = useState('all')
  const [page, setPage] = useState(0)
  const filtering = Boolean(search) || filter !== 'all' || payment !== 'all'
  const filtered = facts.filter(fact => {
    const matchesRelationship = filter === 'all' || (filter === 'expiring' ? expiresSoon(fact, now) : relationship(fact, now) === filter)
    const method = fact.payment_method?.toLowerCase() ?? 'none'
    const matchesPayment = payment === 'all' || method === payment
    return matchesRelationship && matchesPayment && `${fact.display_name ?? ''} ${fact.external_id} ${fact.plan ?? ''}`.toLocaleLowerCase('pt-BR').includes(search.trim().toLocaleLowerCase('pt-BR'))
  })
  const pageSize = 20
  const pages = Math.max(1, Math.ceil(filtered.length / pageSize))
  const currentPage = Math.min(page, pages - 1)
  const visible = filtered.slice(currentPage * pageSize, (currentPage + 1) * pageSize)
  const clearFilters = () => { setSearch(''); setFilter('all'); setPayment('all'); setPage(0) }
  const exportCsv = () => downloadCsv('assinaturas.csv', toCsv(
    ['Cliente', 'Tipo', 'Projeto', 'Plano', 'Situação', 'Vencimento', 'Forma de pagamento', 'Pagamentos', 'Cliente desde'],
    filtered.map(fact => [
      fact.display_name || fact.external_id, fact.entity_kind === 'organization' ? 'Empresarial' : 'Individual',
      sources.find(source => source.id === fact.source_id)?.name ?? '', fact.plan ?? '', relationshipLabels[relationship(fact, now)],
      effectiveExpiry(fact) ? formatDate(effectiveExpiry(fact)) : '', paymentMethodLabel(fact.payment_method), String(fact.payments_count ?? 0),
      fact.first_paid_at ? new Date(fact.first_paid_at).toLocaleDateString('pt-BR') : '',
    ]),
  ))

  return <section className="panel subscriptions-panel" id="subscriptions" aria-labelledby="subscriptions-title">
    <div className="section-heading"><div><h2 id="subscriptions-title">Assinaturas em detalhe</h2><p>Situação de cada cliente, validade e forma de pagamento</p></div><div className="heading-actions"><span className="count-label">{filtered.length} registros</span><button className="secondary-button" type="button" onClick={exportCsv} disabled={!filtered.length}>Exportar CSV</button></div></div>
    <div className="table-toolbar">
      <label className="search-field"><Icon name="search" /><input type="search" aria-label="Buscar assinatura" placeholder="Buscar por nome, identificador ou plano" value={search} onChange={event => { setSearch(event.target.value); setPage(0) }} /></label>
      <label className="status-filter"><span>Situação</span><select value={filter} onChange={event => { setFilter(event.target.value); setPage(0) }}><option value="all">Todas as situações</option><option value="expiring">Vence em breve (7 dias)</option>{(Object.entries(relationshipLabels) as [Relationship, string][]).map(([value, label]) => <option key={value} value={value}>{label}</option>)}</select></label>
      <label className="status-filter"><span>Pagamento</span><select value={payment} onChange={event => { setPayment(event.target.value); setPage(0) }}><option value="all">Todas as formas</option>{paymentFilters.map(([value, label]) => <option key={value} value={value}>{label}</option>)}</select></label>
    </div>
    {visible.length ? <><div className="table-scroll"><table><thead><tr><th>Cliente</th><th>Projeto / plano</th><th>Situação</th><th>Vencimento</th><th>Pagamento</th></tr></thead><tbody>{visible.map(fact => {
      const state = relationship(fact, now)
      const expiry = effectiveExpiry(fact)
      const relative = relativeExpiry(expiry, now)
      const history = paymentHistory(fact)
      const kind = fact.entity_kind === 'organization'
        ? `Empresarial${fact.seat_count ? ` · ${fact.seat_count} ${fact.seat_count === 1 ? 'lugar' : 'lugares'}` : ''}`
        : 'Individual'
      return <tr key={`${fact.source_id}:${fact.entity_kind}:${fact.external_id}`}>
        <td className="cell-customer" title={`Identificador: ${fact.external_id}`}><strong>{fact.display_name || fact.external_id}</strong><span className="table-secondary">{kind}</span></td>
        <td data-label="Projeto">{sources.find(source => source.id === fact.source_id)?.name ?? 'Projeto não identificado'}<span className="table-secondary">{fact.plan ?? 'Plano não informado'}</span></td>
        <td className="cell-status"><span className={`status-badge status-badge--${relationshipBadges[state]}`} title={`Status na origem: ${fact.status}`}>{relationshipLabels[state]}</span>{expiresSoon(fact, now) ? <span className="status-badge status-badge--expiring">Vence em breve</span> : null}</td>
        <td data-label="Vencimento">{formatDate(expiry)}{relative ? <span className="table-secondary">{relative}</span> : null}</td>
        <td data-label="Pagamento">{paymentMethodLabel(fact.payment_method)}{history ? <span className="table-secondary">{history}</span> : null}</td>
      </tr>
    })}</tbody></table></div><div className="pagination"><span>{currentPage * pageSize + 1}–{Math.min((currentPage + 1) * pageSize, filtered.length)} de {filtered.length}</span><div><button className="secondary-button" disabled={currentPage === 0} onClick={() => setPage(currentPage - 1)}>Anterior</button><button className="secondary-button" disabled={currentPage >= pages - 1} onClick={() => setPage(currentPage + 1)}>Próxima</button></div></div></> : <div className="empty-state"><Icon name="subscriptions" /><h3>{filtering ? 'Nenhuma assinatura encontrada' : 'As assinaturas aparecerão aqui'}</h3><p>{filtering ? 'Tente outro nome, identificador, situação ou forma de pagamento.' : 'Quando a primeira coleta terminar, você poderá consultar os dados e filtrar os registros.'}</p>{filtering ? <button className="text-button" onClick={clearFilters}>Limpar filtros</button> : null}</div>}
    <p className="table-note">Ex-assinante é quem já pagou e não tem mais assinatura vigente. Passe o mouse sobre a situação para ver o status original.</p>
  </section>
}
