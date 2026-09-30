import type { SupabaseClient } from '@supabase/supabase-js'
import type { DashboardFact } from './dashboard-query'
import type { FinanceExclusion } from './finance'

export type Source = { id: string; code: string; name: string; status: string; last_success_at: string | null }
export type DashboardSnapshot = { facts: DashboardFact[]; sources: Source[]; exclusions?: FinanceExclusion[] }
export class DashboardAccessError extends Error {}

export async function loadDashboard(client: SupabaseClient, signal: AbortSignal): Promise<DashboardSnapshot> {
  const { data: { user }, error: userError } = await client.auth.getUser()
  if (userError || !user) throw new DashboardAccessError('Não foi possível validar sua sessão. Saia e entre novamente.')
  const { data: admin, error: adminError } = await client.from('monitoring_admins').select('user_id').eq('user_id', user.id).abortSignal(signal).maybeSingle()
  if (adminError) throw new Error('Não foi possível confirmar seu acesso. Tente atualizar novamente.')
  if (!admin) throw new DashboardAccessError('Esta conta não tem acesso ao painel. Entre com uma das contas autorizadas.')

  const [facts, sourcesResult, exclusionsResult] = await Promise.all([
    loadAllFacts(client, signal),
    client.from('monitoring_sources').select('id,code,name,status,last_success_at').order('name').abortSignal(signal),
    client.from('monitoring_finance_exclusions').select('source_id,external_id,entity_kind').abortSignal(signal),
  ])
  if (sourcesResult.error) throw new Error('Não foi possível consultar os projetos. Tente atualizar novamente.')
  if (exclusionsResult.error) throw new Error('Não foi possível consultar as contas internas. Tente atualizar novamente.')
  return {
    facts,
    sources: (sourcesResult.data ?? []) as Source[],
    exclusions: (exclusionsResult.data ?? []) as FinanceExclusion[],
  }
}

export async function loadAllFacts(client: SupabaseClient, signal: AbortSignal): Promise<DashboardFact[]> {
  const result: DashboardFact[] = []
  const pageSize = 500
  for (let offset = 0; ; offset += pageSize) {
    const { data, error } = await client.from('monitoring_subscription_facts')
      .select('source_id,external_id,entity_kind,display_name,plan,status,period_end_at,trial_end_at,seat_count,provider,amount_cents,currency')
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
