import type { SubscriptionHealth as SubscriptionHealthData } from './dashboard-query'

export function SubscriptionHealth({ health, available = true, loading = false }: { health: SubscriptionHealthData; available?: boolean; loading?: boolean }) {
  const value = (number: number) => available ? number.toLocaleString('pt-BR') : '—'
  return <section className="health-grid" aria-label="Resumo de assinaturas">
    <Metric label="Assinaturas válidas" value={value(health.valid)} tone="healthy" note="Situação ativa e data vigente" />
    <Metric label="Vencem em 7 dias" value={value(health.expiringSoon)} tone="attention" note="Acompanhe as próximas renovações" />
    <Metric label="Expiradas ou divergentes" value={value(health.expiredOrInconsistent)} tone="critical" note="Registros que pedem atenção" />
    <Metric label="Sem vencimento" value={value(health.withoutExpiry)} tone="neutral" note="Validade ainda não confirmada" />
    {loading ? <p className="metrics-note" role="status">Consultando os indicadores…</p> : health.individuals + health.organizations === 0 ? <p className="metrics-note">Ainda não há uma fotografia para exibir.</p> : null}
  </section>
}

function Metric({ label, value, tone, note }: { label: string; value: string; tone: string; note: string }) {
  return <article className={`health-metric health-metric--${tone}`}><span>{label}<i /></span><strong>{value}</strong><small>{note}</small></article>
}
