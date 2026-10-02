import 'jsr:@supabase/functions-js/edge-runtime.d.ts'
import { createClient } from 'npm:@supabase/supabase-js@2'
import webpush from 'web-push'
import { dispatchNotifications, type PushTarget, type SendResult } from '../_shared/push-dispatch.ts'

// Shown to push services as the sender's contact.
const vapidSubject = 'https://paineldecontrolemk.pages.dev'

Deno.serve(async (request) => {
  const schedulerKey = Deno.env.get('MONITORING_SCHEDULER_KEY')
  if (!schedulerKey || request.headers.get('apikey') !== schedulerKey) {
    return Response.json({ error: 'Unauthorized' }, { status: 401 })
  }

  const central = createClient(requiredEnvironment('SUPABASE_URL'), requiredEnvironment('SUPABASE_SERVICE_ROLE_KEY'), {
    auth: { autoRefreshToken: false, persistSession: false },
  })

  try {
    const keys = await vapidKeys(central)
    webpush.setVapidDetails(vapidSubject, keys.vapid_public, keys.vapid_private)

    const result = await dispatchNotifications({
      loadPending: async () => {
        const since = new Date(Date.now() - 2 * 86400000).toISOString()
        const { data, error } = await central.from('monitoring_notifications')
          .select('id,kind,title,body,url,target_user').is('sent_at', null).gte('created_at', since).order('id').limit(100)
        if (error) throw new Error('PUSH_LOAD_FAILED')
        return data ?? []
      },
      loadSubscriptions: async () => {
        const { data, error } = await central.from('monitoring_push_subscriptions').select('endpoint,p256dh,auth,user_id')
        if (error) throw new Error('PUSH_LOAD_FAILED')
        return (data ?? []) as PushTarget[]
      },
      send: async (target, payload): Promise<SendResult> => {
        try {
          await webpush.sendNotification({ endpoint: target.endpoint, keys: { p256dh: target.p256dh, auth: target.auth } }, payload, { TTL: 86400 })
          return 'sent'
        } catch (error) {
          const status = typeof error === 'object' && error !== null && 'statusCode' in error ? Number(error.statusCode) : 0
          return status === 404 || status === 410 ? 'gone' : 'failed'
        }
      },
      removeSubscription: async (endpoint) => {
        await central.from('monitoring_push_subscriptions').delete().eq('endpoint', endpoint)
      },
      markSent: async (ids) => {
        const { error } = await central.from('monitoring_notifications').update({ sent_at: new Date().toISOString() }).in('id', ids)
        if (error) throw new Error('PUSH_MARK_FAILED')
      },
    })

    return Response.json(result)
  } catch (error) {
    return Response.json({ error: error instanceof Error ? error.message : 'PUSH_FAILED' }, { status: 502 })
  }
})

/** VAPID keys are generated here on the first run, so the private key never leaves the backend. */
async function vapidKeys(central: ReturnType<typeof createClient>) {
  const existing = await central.from('monitoring_push_config').select('vapid_public,vapid_private').maybeSingle()
  if (existing.error) throw new Error('PUSH_CONFIG_FAILED')
  if (existing.data) return existing.data as { vapid_public: string; vapid_private: string }

  const generated = webpush.generateVAPIDKeys()
  await central.from('monitoring_push_config').upsert({ id: 1, vapid_public: generated.publicKey, vapid_private: generated.privateKey }, { onConflict: 'id', ignoreDuplicates: true })
  const stored = await central.from('monitoring_push_config').select('vapid_public,vapid_private').single()
  if (stored.error) throw new Error('PUSH_CONFIG_FAILED')
  return stored.data as { vapid_public: string; vapid_private: string }
}

function requiredEnvironment(name: string): string {
  const value = Deno.env.get(name)?.trim()
  if (!value) throw new Error(name + ' is required')
  return value
}
