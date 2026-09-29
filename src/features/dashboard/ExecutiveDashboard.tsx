import { useEffect, useState } from 'react'
import { getSupabaseClient } from '../../lib/supabase'
import { SubscriptionHealth } from './SubscriptionHealth'
import { summarizeSubscriptionHealth, type DashboardFact } from './dashboard-query'

type Source = { code: string; name: string; status: string; last_success_at: string | null }

export function ExecutiveDashboard({ onSignOut }: { onSignOut: () => void }) {
  const [facts, setFacts] = useState<DashboardFact[] | null>(null)
  const [sources, setSources] = useState<Source[]>([])
  const [error, setError] = useState<string | null>(null)

  useEffect(() => {
    const supabase = getSupabaseClient()
    if (!supabase) return
    void (async () => {
      const [factsResult, sourcesResult] = await Promise.all([
        supabase.from('monitoring_subscription_facts').select('external_id,entity_kind,display_name,plan,status,period_end_at,trial_end_at,seat_count,provider').eq('is_current', true),
        supabase.from('monitoring_sources').select('code,name,status,last_success_at'),
      ])
      if (factsResult.error || sourcesResult.error) { setError('Não foi possível carregar a fotografia do negócio.'); return }
      setFacts((factsResult.data ?? []) as DashboardFact[])
      setSources((sourcesResult.data ?? []) as Source[])
    })()
  }, [])

  const health = summarizeSubscriptionHealth(facts ?? [], new Date())
  return <main className="dashboard-shell"><header className="dashboard-header"><div><p className="product-mark">Painel de Controle</p><h1>Resumo executivo</h1></div><button className="secondary-button" onClick={onSignOut} type="button">Sair</button></header><p className="dashboard-lead">Acompanhe o que está saudável e o que pede atenção.</p>{error ? <p className="form-error" role="alert">{error}</p> : facts === null ? <p className="dashboard-empty">Carregando fotografia…</p> : <SubscriptionHealth health={health} />}<section className="source-list" aria-label="Fontes monitoradas">{sources.map((source) => <article key={source.code}><div><strong>{source.name}</strong><span>{source.last_success_at ? `Atualizado em ${new Date(source.last_success_at).toLocaleString('pt-BR')}` : 'Aguardando primeira sincronização'}</span></div><b data-status={source.status}>{source.status === 'healthy' ? 'Saudável' : source.status === 'stale' ? 'Desatualizada' : 'Atenção'}</b></article>)}</section></main>
}
