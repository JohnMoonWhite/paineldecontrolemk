import { factState, isFreePlan, type DashboardFact } from './dashboard-query'

/** Where a customer stands with the product, combining status, dates and payment history. */
export type Relationship = 'subscriber' | 'cancelling' | 'overdue' | 'trial' | 'trial-expired' | 'free' | 'former' | 'inactive'

export const relationshipLabels: Record<Relationship, string> = {
  subscriber: 'Assinante ativo',
  cancelling: 'Cancelamento agendado',
  overdue: 'Pagamento atrasado',
  trial: 'Em teste',
  'trial-expired': 'Teste expirado',
  free: 'Plano grátis',
  former: 'Ex-assinante',
  inactive: 'Inativo',
}

const payingStatuses = new Set(['active', 'paid'])
const overdueStatuses = new Set(['past_due', 'unpaid'])

export function relationship(fact: DashboardFact, now: Date): Relationship {
  const status = fact.status.toLowerCase()
  const expired = factState(fact, now) === 'expired'
  const everPaid = (fact.payments_count ?? 0) > 0 || Boolean(fact.payment_method)

  if (overdueStatuses.has(status)) return 'overdue'
  if (payingStatuses.has(status) && !expired) return fact.cancel_at_period_end ? 'cancelling' : 'subscriber'
  if (isFreePlan(fact)) return everPaid ? 'former' : 'free'
  if (status === 'trialing' && !expired) return 'trial'
  if (everPaid || payingStatuses.has(status)) return 'former'
  return status === 'trialing' ? 'trial-expired' : 'inactive'
}

const paymentMethodLabels: Record<string, string> = {
  pix: 'PIX',
  stripe: 'Cartão (Stripe)',
  mercadopago: 'Mercado Pago',
}

export function paymentMethodLabel(method: string | null | undefined): string {
  if (!method) return 'Não informado'
  return paymentMethodLabels[method.toLowerCase()] ?? method
}
