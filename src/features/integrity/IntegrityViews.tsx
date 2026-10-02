import { Icon } from '../../components/Icon'
import { percent, siteStatus, summarizeIntegrity, type SiteHealth, type SiteStatus } from './integrity'

const statusLabels: Record<SiteStatus, string> = { online: 'Online', slow: 'Lento', offline: 'Fora do ar', unknown: 'Sem dados' }
const overallLabels = { ok: 'Tudo normal', attention: 'Atenção', down: 'Fora do ar', empty: 'Sem sites' } as const

const formatPercent = (value: number | string | null) => {
  const number = percent(value)
  return number === null ? '—' : `${number.toLocaleString('pt-BR', { minimumFractionDigits: 2, maximumFractionDigits: 2 })}%`
}

function lastCheck(site: SiteHealth, now: Date) {
  if (!site.checked_at) return 'Nunca verificado'
  const minutes = Math.max(0, Math.floor((now.getTime() - Date.parse(site.checked_at)) / 60000))
  if (minutes < 1) return 'agora'
  if (minutes < 60) return `há ${minutes} min`
  const hours = Math.floor(minutes / 60)
  return hours < 48 ? `há ${hours} h` : `há ${Math.floor(hours / 24)} dias`
}

function answer(site: SiteHealth, status: SiteStatus) {
  if (status === 'unknown' || site.status_code === null) return status === 'offline' ? 'Sem resposta' : '—'
  if (status === 'offline') return `HTTP ${site.status_code}`
  // Databases answer 401 by design (the endpoint needs a key), which means they are up.
  return site.kind === 'database' ? 'Respondendo' : `${site.status_code} OK`
}

function host(url: string) {
  try { return new URL(url).host } catch { return url }
}

/** Compact strip for the overview: overall state, counts and one dot per site. */
export function IntegritySummary({ sites, now }: { sites: SiteHealth[]; now: Date }) {
  const summary = summarizeIntegrity(sites, now)
  if (summary.overall === 'empty') return null
  return <section className={`integrity-strip integrity-strip--${summary.overall}`} aria-label="Integridade dos projetos">
    <span className="integrity-pill"><i />{overallLabels[summary.overall]}</span>
    <div className="integrity-strip__text">
      <strong>Integridade dos projetos</strong>
      <span>{summary.online} de {summary.total} online</span>
      {summary.offline ? <span className="integrity-strip__alert">{summary.offline} fora do ar</span> : null}
      {summary.attention ? <span className="integrity-strip__warn">{summary.attention} com atenção</span> : null}
      {summary.uptime30d !== null ? <span>Disponibilidade 30 dias: {formatPercent(summary.uptime30d)}</span> : null}
    </div>
    <ul className="integrity-dots" aria-hidden="true">{sites.map(site => <li key={site.id} className={`dot dot--${siteStatus(site, now)}`} title={`${site.name}: ${statusLabels[siteStatus(site, now)]}`} />)}</ul>
    <a className="integrity-strip__link" href="#integridade">Ver detalhes <Icon name="arrow" /></a>
  </section>
}

/** Recent answer times; offline checks drop to the baseline in red. */
function Sparkline({ points, status }: { points: SiteHealth['trend']; status: SiteStatus }) {
  if (points.length < 2) return <span className="sparkline sparkline--empty">Coletando histórico…</span>
  const values = points.map(([latency]) => latency ?? 0)
  const max = Math.max(...values, 1)
  const width = 140
  const height = 34
  const step = width / (points.length - 1)
  const coords = values.map((value, index) => `${(index * step).toFixed(1)},${(height - 3 - (value / max) * (height - 8)).toFixed(1)}`)
  const failures = points.map(([, state], index) => state === 'offline' ? <circle key={index} cx={index * step} cy={height - 3} r="2.4" /> : null)
  return <svg className={`sparkline sparkline--${status}`} viewBox={`0 0 ${width} ${height}`} width={width} height={height} aria-hidden="true">
    <polyline points={`0,${height} ${coords.join(' ')} ${width},${height}`} className="sparkline__area" />
    <polyline points={coords.join(' ')} className="sparkline__line" />
    <g className="sparkline__failures">{failures}</g>
  </svg>
}

/** Detailed view opened from the header: one row per monitored site. */
export function IntegrityPage({ sites, now }: { sites: SiteHealth[]; now: Date }) {
  const summary = summarizeIntegrity(sites, now)
  return <section className="panel integrity-panel" id="integrity" aria-labelledby="integrity-title">
    <div className="section-heading">
      <div><h2 id="integrity-title">Integridade dos projetos</h2><p>Disponibilidade e tempo de resposta, verificados a cada 5 minutos</p></div>
      <div className="integrity-overall"><span className={`integrity-pill integrity-pill--${summary.overall}`}><i />{overallLabels[summary.overall]}</span>
        {summary.uptime30d !== null ? <small>Disponibilidade geral (30 dias): <b>{formatPercent(summary.uptime30d)}</b></small> : null}</div>
    </div>
    {sites.length ? <ul className="integrity-list">{sites.map(site => {
      const status = siteStatus(site, now)
      return <li key={site.id} className={`integrity-row integrity-row--${status}`}>
        <span className="source-avatar">{site.kind === 'database' ? 'DB' : site.name.slice(0, 2)}</span>
        <div className="integrity-row__name"><strong>{site.name}</strong><a href={site.url} target="_blank" rel="noreferrer">{host(site.url)}</a></div>
        <span className={`status-pill status-pill--${status}`}><i />{statusLabels[status]}</span>
        <dl className="integrity-row__figures">
          <div><dt>Resposta</dt><dd>{site.latency_ms !== null && status !== 'offline' ? `${site.latency_ms} ms` : '—'}</dd></div>
          <div><dt>{site.kind === 'database' ? 'Serviço' : 'HTTP'}</dt><dd>{answer(site, status)}</dd></div>
          <div><dt>Uptime 30d</dt><dd>{formatPercent(site.uptime_30d)}</dd></div>
        </dl>
        <Sparkline points={site.trend} status={status} />
        <div className="integrity-row__last"><span>Última verificação</span><b>{lastCheck(site, now)}</b></div>
      </li>
    })}</ul> : <div className="empty-state"><p>Nenhum site monitorado ainda.</p></div>}
    <dl className="integrity-totals">
      <div><dt>Monitorados</dt><dd>{summary.total}</dd></div>
      <div className="integrity-totals--online"><dt>Online</dt><dd>{summary.online}</dd></div>
      <div className="integrity-totals--attention"><dt>Atenção</dt><dd>{summary.attention}</dd></div>
      <div className="integrity-totals--offline"><dt>Fora do ar</dt><dd>{summary.offline}</dd></div>
    </dl>
    <p className="table-note">Os bancos do Supabase respondem 401 de propósito (a rota exige chave); isso indica que estão no ar. Você recebe uma notificação quando algo cai e quando volta.</p>
  </section>
}
