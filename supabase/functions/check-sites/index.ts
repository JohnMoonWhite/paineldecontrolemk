import 'jsr:@supabase/functions-js/edge-runtime.d.ts'
import { createClient } from 'npm:@supabase/supabase-js@2'
import { classifyCheck, type Expectation, type Probe } from '../_shared/site-checks.ts'

const timeoutMs = 10000

Deno.serve(async (request) => {
  const schedulerKey = Deno.env.get('MONITORING_SCHEDULER_KEY')
  if (!schedulerKey || request.headers.get('apikey') !== schedulerKey) {
    return Response.json({ error: 'Unauthorized' }, { status: 401 })
  }

  const central = createClient(requiredEnvironment('SUPABASE_URL'), requiredEnvironment('SUPABASE_SERVICE_ROLE_KEY'), {
    auth: { autoRefreshToken: false, persistSession: false },
  })

  const { data: sites, error } = await central.from('monitoring_sites').select('id,url,expectation').eq('active', true)
  if (error) return Response.json({ error: 'SITES_LOAD_FAILED' }, { status: 502 })

  const checks = await Promise.all((sites ?? []).map(async (site) => {
    const result = await probe(site.url as string)
    return {
      site_id: site.id,
      state: classifyCheck(site.expectation as Expectation, result),
      status_code: result.status,
      latency_ms: result.latencyMs,
      error: result.error ?? null,
    }
  }))

  const { data: written, error: writeError } = await central.rpc('record_site_checks', { p_checks: checks })
  if (writeError) return Response.json({ error: 'CHECKS_WRITE_FAILED' }, { status: 502 })
  return Response.json({ checked: written, offline: checks.filter(check => check.state === 'offline').length })
})

async function probe(url: string): Promise<Probe> {
  const started = performance.now()
  try {
    const response = await fetch(url, { redirect: 'follow', signal: AbortSignal.timeout(timeoutMs), headers: { 'User-Agent': 'MKHub-Monitor/1.0' } })
    await response.body?.cancel()
    return { status: response.status, latencyMs: Math.round(performance.now() - started) }
  } catch (cause) {
    const timedOut = cause instanceof Error && cause.name === 'TimeoutError'
    return { status: null, latencyMs: null, error: timedOut ? 'Sem resposta em 10 s' : 'Falha de conexão' }
  }
}

function requiredEnvironment(name: string): string {
  const value = Deno.env.get(name)?.trim()
  if (!value) throw new Error(name + ' is required')
  return value
}
