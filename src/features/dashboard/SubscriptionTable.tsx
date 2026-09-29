import { useState } from 'react'
import { Icon } from '../../components/Icon'
import { effectiveExpiry, factState, factStateLabels, type DashboardFact, type FactState } from './dashboard-query'
import type { Source } from './dashboard-data'

function formatDate(value: string | null) {
  if (!value) return 'Não informada'
  const date = new Date(value)
  return Number.isFinite(date.getTime()) ? date.toLocaleString('pt-BR', { dateStyle: 'short', timeStyle: 'short' }) : 'Data inválida'
}

export function SubscriptionTable({ facts, sources, now }: { facts: DashboardFact[]; sources: Source[]; now: Date }) {
  const [search, setSearch] = useState('')
  const [filter, setFilter] = useState('all')
  const [page, setPage] = useState(0)
  const filtered = facts.filter(fact => {
    const state = factState(fact, now)
    const matchesState = filter === 'all' || (filter === 'valid' ? state === 'valid' || state === 'expiring' : state === filter)
    return matchesState && `${fact.display_name ?? ''} ${fact.external_id} ${fact.plan ?? ''}`.toLocaleLowerCase('pt-BR').includes(search.trim().toLocaleLowerCase('pt-BR'))
  })
  const pageSize = 20
  const pages = Math.max(1, Math.ceil(filtered.length / pageSize))
  const currentPage = Math.min(page, pages - 1)
  const visible = filtered.slice(currentPage * pageSize, (currentPage + 1) * pageSize)

  return <section className="panel subscriptions-panel" id="subscriptions" aria-labelledby="subscriptions-title">
    <div className="section-heading"><div><h2 id="subscriptions-title">Assinaturas em detalhe</h2><p>Identificação, plano e validade informados pela origem</p></div><span className="count-label">{filtered.length} registros</span></div>
    <div className="table-toolbar"><label className="search-field"><Icon name="search" /><input type="search" aria-label="Buscar assinatura" placeholder="Buscar por nome, identificador ou plano" value={search} onChange={event => { setSearch(event.target.value); setPage(0) }} /></label><label className="status-filter"><span>Situação</span><select value={filter} onChange={event => { setFilter(event.target.value); setPage(0) }}><option value="all">Todas as situações</option>{(Object.entries(factStateLabels) as [FactState, string][]).map(([value, label]) => <option key={value} value={value}>{label}</option>)}</select></label></div>
    {visible.length ? <><div className="table-scroll"><table><thead><tr><th>Assinatura</th><th>Projeto / plano</th><th>Situação</th><th>Vencimento</th><th>Membros</th></tr></thead><tbody>{visible.map(fact => {
      const state = factState(fact, now)
      return <tr key={`${fact.source_id}:${fact.entity_kind}:${fact.external_id}`}><td><strong>{fact.display_name || fact.external_id}</strong><span className="table-secondary">{fact.display_name ? fact.external_id : fact.entity_kind === 'organization' ? 'Empresarial' : 'Individual'}</span></td><td>{sources.find(source => source.id === fact.source_id)?.name ?? 'Projeto não identificado'}<span className="table-secondary">{fact.plan ?? 'Plano não informado'}</span></td><td><span className={`status-badge status-badge--${state}`}>{factStateLabels[state]}</span><span className="table-secondary">Na origem: {fact.status}</span></td><td>{formatDate(effectiveExpiry(fact))}</td><td>{fact.entity_kind === 'organization' ? fact.seat_count ?? '—' : '—'}</td></tr>
    })}</tbody></table></div><div className="pagination"><span>{currentPage * pageSize + 1}–{Math.min((currentPage + 1) * pageSize, filtered.length)} de {filtered.length}</span><div><button className="secondary-button" disabled={currentPage === 0} onClick={() => setPage(currentPage - 1)}>Anterior</button><button className="secondary-button" disabled={currentPage >= pages - 1} onClick={() => setPage(currentPage + 1)}>Próxima</button></div></div></> : <div className="empty-state"><Icon name="subscriptions" /><h3>{search || filter !== 'all' ? 'Nenhuma assinatura encontrada' : 'As assinaturas aparecerão aqui'}</h3><p>{search || filter !== 'all' ? 'Tente outro nome, identificador ou situação.' : 'Quando a primeira coleta terminar, você poderá consultar os dados e filtrar os registros.'}</p>{search || filter !== 'all' ? <button className="text-button" onClick={() => { setSearch(''); setFilter('all'); setPage(0) }}>Limpar filtros</button> : null}</div>}
    <p className="table-note">Uma assinatura sem vencimento não tem validade confirmada. Datas e situação são avaliadas em conjunto.</p>
  </section>
}
