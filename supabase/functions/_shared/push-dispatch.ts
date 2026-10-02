export type PushTarget = { endpoint: string; p256dh: string; auth: string; user_id: string }

export type PendingNotification = {
  id: number
  kind: string
  title: string
  body: string
  url: string
  target_user: string | null
}

export type SendResult = 'sent' | 'gone' | 'failed'

type Dependencies = {
  loadPending: () => Promise<PendingNotification[]>
  loadSubscriptions: () => Promise<PushTarget[]>
  send: (target: PushTarget, payload: string) => Promise<SendResult>
  removeSubscription: (endpoint: string) => Promise<void>
  markSent: (ids: number[]) => Promise<void>
}

/** Pushes every pending notification once; devices that unsubscribed are forgotten. */
export async function dispatchNotifications(dependencies: Dependencies) {
  const pending = await dependencies.loadPending()
  if (!pending.length) return { notifications: 0, delivered: 0, removed: 0, failed: 0 }

  const subscriptions = await dependencies.loadSubscriptions()
  const gone = new Set<string>()
  let delivered = 0
  let failed = 0

  for (const notification of pending) {
    const payload = JSON.stringify({ title: notification.title, body: notification.body, url: notification.url, tag: `${notification.kind}-${notification.id}` })
    const targets = subscriptions.filter(target => !gone.has(target.endpoint) && (!notification.target_user || target.user_id === notification.target_user))
    for (const target of targets) {
      const result = await dependencies.send(target, payload)
      if (result === 'sent') delivered++
      else if (result === 'gone') gone.add(target.endpoint)
      else failed++
    }
  }

  for (const endpoint of gone) await dependencies.removeSubscription(endpoint)
  // A notification is attempted once; retrying later would deliver stale news.
  await dependencies.markSent(pending.map(notification => notification.id))
  return { notifications: pending.length, delivered, removed: gone.size, failed }
}
