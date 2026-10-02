import type { SupabaseClient } from '@supabase/supabase-js'
import type { DashboardFact } from './dashboard-query'
import type { FinanceExclusion, ManualAmount } from './finance'
import type { LedgerEntry, SystemPayment } from './ledger'
import type { TeamMember } from './TeamPanel'

export type Source = { id: string; code: string; name: string; status: string; last_success_at: string | null }
export type DashboardSnapshot = { facts: DashboardFact[]; sources: Source[]; exclusions?: FinanceExclusion[]; manualAmounts?: ManualAmount[]; ledgerEntries?: LedgerEntry[]; payments?: SystemPayment[]; team?: TeamMember[] }
export class DashboardAccessError extends Error {}

export async function loadDashboard(client: SupabaseClient, signal: AbortSignal): Promise<DashboardSnapshot> {
  const { data: { user }, error: userError } = await client.auth.getUser()
  if (userError || !user) throw new DashboardAccessError('Não foi possível validar sua sessão. Saia e entre novamente.')
  const { data: admin, error: adminError } = await client.from('monitoring_admins').select('user_id').eq('user_id', user.id).abortSignal(signal).maybeSingle()
  if (adminError) throw new Error('Não foi possível confirmar seu acesso. Tente atualizar novamente.')
  if (!admin) throw new DashboardAccessError('Esta conta não tem acesso ao painel. Entre com uma das contas autorizadas.')

  const [facts, sourcesResult, exclusionsResult, manualResult, ledgerResult, paymentsResult, teamResult] = await Promise.all([
    loadAllFacts(client, signal),
    client.from('monitoring_sources').select('id,code,name,status,last_success_at').order('name').abortSignal(signal),
    client.from('monitoring_finance_exclusions').select('source_id,external_id,entity_kind').abortSignal(signal),
    client.from('monitoring_manual_amounts').select('source_id,external_id,entity_kind,amount_cents,billing_months').abortSignal(signal),
    client.from('monitoring_ledger_entries').select('id,kind,amount_cents,entry_date,description,category,payment_method,author_name').is('deleted_at', null).order('entry_date', { ascending: false }).abortSignal(signal),
    client.from('monitoring_payments').select('source_id,reference,external_id,entity_kind,method,paid_at,amount_cents').order('paid_at', { ascending: false }).abortSignal(signal),
    client.rpc('list_monitoring_team').abortSignal(signal),
  ])
  if (sourcesResult.error) throw new Error('Não foi possível consultar os projetos. Tente atualizar novamente.')
  if (exclusionsResult.error || manualResult.error) throw new Error('Não foi possível consultar os ajustes financeiros. Tente atualizar novamente.')
  if (ledgerResult.error || paymentsResult.error) throw new Error('Não foi possível consultar o caixa da empresa. Tente atualizar novamente.')
  return {
    facts,
    sources: (sourcesResult.data ?? []) as Source[],
    exclusions: (exclusionsResult.data ?? []) as FinanceExclusion[],
    manualAmounts: (manualResult.data ?? []) as ManualAmount[],
    ledgerEntries: (ledgerResult.data ?? []) as LedgerEntry[],
    payments: (paymentsResult.data ?? []) as SystemPayment[],
    // The team list is a convenience; without it everyone keeps the editor view.
    team: teamResult.error ? [] : (teamResult.data ?? []) as TeamMember[],
  }
}

export async function loadAllFacts(client: SupabaseClient, signal: AbortSignal): Promise<DashboardFact[]> {
  const result: DashboardFact[] = []
  const pageSize = 500
  for (let offset = 0; ; offset += pageSize) {
    const { data, error } = await client.from('monitoring_subscription_facts')
      .select('source_id,external_id,entity_kind,display_name,plan,status,period_end_at,trial_end_at,seat_count,provider,amount_cents,currency,cancel_at_period_end,payment_method,payments_count,first_paid_at,last_paid_at')
      .eq('is_current', true).order('id').range(offset, offset + pageSize - 1).abortSignal(signal)
    if (error) throw new Error('Não foi possível consultar todas as assinaturas. A última leitura foi preservada.')
    const rows = (data ?? []) as DashboardFact[]
    result.push(...rows)
    if (rows.length < pageSize) return result
  }
}

export function sourceHealth(source: Source, now: Date): 'healthy' | 'warning' | 'stale' | 'pending' {
  if (!source.last_success_at) return 'pending'
  const timestamp = Date.parse(source.last_success_at)
  if (!Number.isFinite(timestamp) || now.getTime() - timestamp >= 15 * 60000) return 'stale'
  return source.status === 'healthy' ? 'healthy' : 'warning'
}
