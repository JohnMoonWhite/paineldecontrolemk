import { useMemo, useState } from 'react'
import { Brand } from '../../components/Brand'
import { Icon } from '../../components/Icon'
import { SubscriptionHealth } from './SubscriptionHealth'
import { SubscriptionTable } from './SubscriptionTable'
import { summarizeSubscriptionHealth } from './dashboard-query'
import { sourceHealth } from './dashboard-data'
import { useDashboard } from './useDashboard'

const sourceLabels = { healthy: 'Em dia', warning: 'Atenção', stale: 'Desatualizado', pending: 'Sem sincronização' }

export function ExecutiveDashboard({ onSignOut }: { onSignOut: () => void }) {
  const data = useDashboard()
  return <DashboardView {...data} onSignOut={onSignOut} />
}

export function DashboardView({ snapshot, error, refreshing, syncing, updatedAt, now, syncNow, onSignOut }: ReturnType<typeof useDashboard> & { onSignOut: () => void }) {
  const [sourceId, setSourceId] = useState('all')
  const sources = snapshot?.sources ?? []
  const selectedSources = sources.filter(source => sourceId === 'all' || source.id === sourceId)
  const facts = useMemo(() => (snapshot?.facts ?? []).filter(fact => sourceId === 'all' || fact.source_id === sourceId), [snapshot, sourceId])
  const health = summarizeSubscriptionHealth(facts, now)
  const hasData = facts.length > 0 || selectedSources.some(source => source.last_success_at)
  const needsAttention = selectedSources.some(source => sourceHealth(source, now) !== 'healthy')

  return <div className="dashboard-layout">
    <a className="skip-link" href="#overview">Ir para o conteúdo</a>
    <header className="masthead">
      <Brand compact />
      <nav aria-label="Navegação principal">
        <a className="nav-link nav-link--primary" href="#overview"><Icon name="overview" />Visão geral</a>
        <a className="nav-link" href="#projects"><Icon name="projects" />Projetos<span>{sources.length || '—'}</span></a>
        <a className="nav-link" href="#subscriptions"><Icon name="subscriptions" />Assinaturas</a>
      </nav>
      <button className="nav-link signout-button" onClick={onSignOut} type="button"><Icon name="logout" /><span>Sair da conta</span></button>
    </header>
    <main className="dashboard-main">
      <div className="dashboard-content">
        <section id="overview" className="overview-section">
          <div className="dashboard-header"><div className="executive-heading"><p className="date-label">{now.toLocaleDateString('pt-BR', { day: 'numeric', month: 'long', year: 'numeric' })}</p><h1>Resumo executivo</h1><p className="dashboard-lead">Seus projetos. A visão completa.</p><span className="read-only"><Icon name="shield" />Consulta às origens somente para leitura</span></div><div className="executive-brand"><img src="/brand/mkhub.png" alt="MKHUB — Controle, gestão e resultados" width="1536" height="1024" /></div></div>
          <div className="overview-toolbar"><label className="source-filter">Projeto<select value={sourceId} onChange={event => setSourceId(event.target.value)}><option value="all">Todos os projetos</option>{sources.map(source => <option key={source.id} value={source.id}>{source.name}</option>)}</select></label><div className="refresh-controls"><p className="update-status" aria-live="polite">{updatedAt ? `Painel consultado às ${updatedAt.toLocaleTimeString('pt-BR', { hour: '2-digit', minute: '2-digit' })}` : 'Aguardando consulta'}<span>Atualização a cada 5 minutos</span></p><button className="secondary-button refresh-button" disabled={refreshing || syncing} onClick={() => void syncNow()} type="button"><Icon name="refresh" className={refreshing || syncing ? 'spinning' : ''} />{syncing ? 'Coletando dados…' : refreshing ? 'Atualizando…' : 'Atualizar agora'}</button></div></div>
          {error ? <div className="notice notice--error" role="alert"><Icon name="alert" /><div><strong>Não foi possível atualizar</strong><p>{error}</p>{snapshot ? <p>Os dados abaixo são da última consulta bem-sucedida.</p> : null}</div></div> : null}
          {snapshot && needsAttention ? <div className="notice"><Icon name="alert" /><div><strong>{hasData ? 'Alguns projetos precisam de atenção' : 'Aguardando a primeira coleta de dados'}</strong><p>{hasData ? 'Confira a última sincronização de cada projeto antes de tomar uma decisão.' : 'A conexão foi cadastrada, mas ainda não há uma sincronização bem-sucedida. Os indicadores ficarão disponíveis após a coleta.'}</p></div><a href="#projects" aria-label="Ver estado dos projetos"><Icon name="arrow" /></a></div> : null}
          <SubscriptionHealth health={health} available={hasData} loading={!snapshot && !error} />
        </section>
        <div className="business-grid">
          <section className="panel projects-panel" id="projects" aria-labelledby="projects-title">
            <div className="section-heading"><div><h2 id="projects-title">Projetos monitorados</h2><p>A saúde de cada conexão</p></div><span className="count-label">{selectedSources.length} {selectedSources.length === 1 ? 'projeto' : 'projetos'}</span></div>
            <div className="source-list">{selectedSources.map(source => {
              const state = sourceHealth(source, now)
              const count = (snapshot?.facts ?? []).filter(fact => fact.source_id === source.id).length
              return <article key={source.id} className="source-row"><div className="source-avatar">{source.name.slice(0, 2)}</div><div className="source-info"><strong>{source.name}</strong><span>{source.last_success_at ? `${count} assinaturas na última coleta` : 'Coleta ainda não concluída'}</span><small>{source.last_success_at ? `Última coleta: ${new Date(source.last_success_at).toLocaleString('pt-BR')}` : 'Nenhuma coleta bem-sucedida'}</small></div><span className={`status-badge status-badge--${state}`}>{sourceLabels[state]}</span></article>
            })}</div>
            {snapshot && selectedSources.length === 0 ? <div className="empty-state"><Icon name="projects" /><h3>Nenhum projeto conectado</h3><p>As conexões configuradas aparecerão aqui após a primeira consulta.</p></div> : null}
            {!snapshot ? <div className="empty-state"><p>{error ? 'Os projetos estão indisponíveis nesta consulta.' : 'Consultando os projetos…'}</p></div> : null}
            <div className="panel-footnote"><Icon name="shield" /><span>As origens são consultadas somente para leitura.</span></div>
          </section>
          <section className="panel portfolio-panel" aria-labelledby="portfolio-title"><div className="section-heading"><div><h2 id="portfolio-title">Sua carteira</h2><p>Composição das assinaturas</p></div></div><div className="portfolio-total"><strong>{hasData ? facts.length.toLocaleString('pt-BR') : '—'}</strong><span>assinaturas identificadas</span></div><div className="portfolio-bar" aria-hidden="true">{facts.length ? <><span style={{ width: `${health.individuals / facts.length * 100}%` }} /><span style={{ width: `${health.organizations / facts.length * 100}%` }} /></> : null}</div><dl className="portfolio-breakdown"><div><dt><i />Individuais</dt><dd>{hasData ? health.individuals : '—'}</dd></div><div><dt><i />Empresariais</dt><dd>{hasData ? health.organizations : '—'}</dd></div></dl><p className="portfolio-note">Cada assinatura empresarial conta uma vez, independentemente da quantidade de membros.</p></section>
        </div>
        <SubscriptionTable key={sourceId} facts={facts} sources={sources} now={now} />
        <footer className="dashboard-footer"><span>MKHUB. Clareza para decidir.</span><span>Horários exibidos no seu fuso local</span></footer>
      </div>
    </main>
  </div>
}
