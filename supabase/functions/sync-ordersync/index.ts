import 'jsr:@supabase/functions-js/edge-runtime.d.ts'
import { createClient } from 'npm:@supabase/supabase-js@2'
import postgres from 'postgres'
import { resolveOrderSyncCredentials } from '../_shared/source-credentials.ts'
import { readOrderSyncRecords } from '../_shared/ordersync-source-reader.ts'
import { createOrderSyncRequestHandler } from '../_shared/sync-ordersync-handler.ts'
import { executeOrderSync } from '../_shared/sync-ordersync.ts'

const sourceCode = 'ordersync'

Deno.serve(
  createOrderSyncRequestHandler({
    schedulerKey: () => Deno.env.get('MONITORING_SCHEDULER_KEY'),
    runSync: synchronizeOrderSync,
  }),
)

async function synchronizeOrderSync() {
  const observedAt = new Date().toISOString()
  const central = createCentralClient()

  return executeOrderSync({
    observedAt,
    readRecords: readOrderSyncDatabase,
    replaceSnapshot: async (facts) => {
      const { data, error } = await central.rpc('replace_monitoring_snapshot', {
        p_source_code: sourceCode,
        p_observed_at: observedAt,
        p_facts: facts,
      })

      if (error || typeof data !== 'number') {
        throw new Error('Central snapshot replacement failed')
      }

      return data
    },
    recordFailure: async (summary) => {
      const { error } = await central.rpc('record_monitoring_sync_failure', {
        p_source_code: sourceCode,
        p_error_summary: summary,
      })

      if (error) {
        throw new Error('Central failure recording failed')
      }
    },
  })
}

async function readOrderSyncDatabase() {
  const { databaseUrl } = resolveOrderSyncCredentials()
  const sql = postgres(databaseUrl, {
    connect_timeout: 10,
    idle_timeout: 5,
    max: 1,
    prepare: false,
  })

  try {
    return await readOrderSyncRecords(async (statement) => {
      const rows = await sql.unsafe(statement)
      return Array.from(rows) as Record<string, unknown>[]
    })
  } finally {
    await sql.end({ timeout: 5 })
  }
}

function createCentralClient() {
  const url = requiredEnvironment('SUPABASE_URL')
  const serviceRoleKey = requiredEnvironment('SUPABASE_SERVICE_ROLE_KEY')

  return createClient(url, serviceRoleKey, {
    auth: { autoRefreshToken: false, persistSession: false },
  })
}

function requiredEnvironment(name: string): string {
  const value = Deno.env.get(name)?.trim()
  if (!value) {
    throw new Error(name + ' is required')
  }

  return value
}
