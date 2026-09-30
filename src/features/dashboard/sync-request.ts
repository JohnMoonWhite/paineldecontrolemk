import type { SupabaseClient } from '@supabase/supabase-js'

type WaitOptions = {
  attempts?: number
  intervalMs?: number
  sleep?: (ms: number, signal: AbortSignal) => Promise<void>
}

/** Asks the database to dispatch a collection for every source; returns the server request time. */
export async function requestSourceSync(client: SupabaseClient, signal: AbortSignal): Promise<string> {
  const { data, error } = await client.rpc('request_monitoring_sync').abortSignal(signal)
  if (error || typeof data !== 'string') {
    throw new Error('Não foi possível solicitar uma nova coleta. Os dados exibidos são da última coleta.')
  }
  return data
}

/** Resolves true once every source recorded an attempt at or after the request, false on timeout. */
export async function waitForSourceSync(
  client: SupabaseClient,
  requestedAt: string,
  signal: AbortSignal,
  { attempts = 12, intervalMs = 2000, sleep = abortableSleep }: WaitOptions = {},
): Promise<boolean> {
  const target = Date.parse(requestedAt)
  for (let attempt = 0; attempt < attempts && !signal.aborted; attempt++) {
    await sleep(intervalMs, signal)
    const { data, error } = await client.from('monitoring_sources').select('last_attempt_at').abortSignal(signal)
    const sources = (data ?? []) as { last_attempt_at: string | null }[]
    if (!error && sources.every(source => source.last_attempt_at && Date.parse(source.last_attempt_at) >= target)) {
      return true
    }
  }
  return false
}

function abortableSleep(ms: number, signal: AbortSignal): Promise<void> {
  return new Promise(resolve => {
    const timer = window.setTimeout(resolve, ms)
    signal.addEventListener('abort', () => { window.clearTimeout(timer); resolve() }, { once: true })
  })
}
