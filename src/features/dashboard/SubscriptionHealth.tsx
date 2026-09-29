import type { SubscriptionHealth as SubscriptionHealthData } from './dashboard-query'

export function SubscriptionHealth({ health }: { health: SubscriptionHealthData }) {
  if (health.valid + health.expiredOrInconsistent + health.withoutExpiry === 0) {
    return <p className="dashboard-empty">Ainda não há uma fotografia para exibir.</p>
  }

  return <section className="health-grid" aria-label="Resumo de assinaturas">
    <Metric label="Válidas" value={health.valid} tone="healthy" />
    <Metric label="Vencem em 7 dias" value={health.expiringSoon} tone="attention" />
    <Metric label="Expiradas ou divergentes" value={health.expiredOrInconsistent} tone="critical" />
    <Metric label="Sem data de expiração" value={health.withoutExpiry} tone="neutral" />
  </section>
}

function Metric({ label, value, tone }: { label: string; value: number; tone: string }) {
  return <article className={`health-metric health-metric--${tone}`}><span>{label}</span><strong>{value}</strong></article>
}
