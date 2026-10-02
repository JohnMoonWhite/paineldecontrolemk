import type { SupabaseClient } from '@supabase/supabase-js'

export type PushState = 'unsupported' | 'needs-install' | 'denied' | 'off' | 'on'

const isIos = () => /iphone|ipad|ipod/i.test(navigator.userAgent)
const isInstalled = () => window.matchMedia?.('(display-mode: standalone)').matches || (navigator as Navigator & { standalone?: boolean }).standalone === true

export async function currentPushState(): Promise<PushState> {
  if (!('serviceWorker' in navigator) || !('PushManager' in window) || !('Notification' in window)) {
    // iPhone only offers push to apps added to the home screen.
    return isIos() && !isInstalled() ? 'needs-install' : 'unsupported'
  }
  if (Notification.permission === 'denied') return 'denied'
  const registration = await navigator.serviceWorker.getRegistration()
  const subscription = await registration?.pushManager.getSubscription()
  return subscription ? 'on' : 'off'
}

export async function enablePush(client: SupabaseClient): Promise<void> {
  const permission = await Notification.requestPermission()
  if (permission !== 'granted') throw new Error('Permissão de notificação não concedida.')

  const { data: publicKey, error } = await client.rpc('get_push_public_key')
  if (error || typeof publicKey !== 'string') throw new Error('Não foi possível preparar as notificações. Tente novamente.')

  const registration = await navigator.serviceWorker.ready
  const subscription = await registration.pushManager.subscribe({ userVisibleOnly: true, applicationServerKey: base64UrlToBytes(publicKey) })
  const json = subscription.toJSON()
  const saved = await client.rpc('save_push_subscription', { p_endpoint: json.endpoint, p_p256dh: json.keys?.p256dh, p_auth: json.keys?.auth })
  if (saved.error) {
    await subscription.unsubscribe()
    throw new Error('Não foi possível salvar este aparelho. Tente novamente.')
  }
  await client.rpc('request_test_notification')
}

export async function disablePush(client: SupabaseClient): Promise<void> {
  const registration = await navigator.serviceWorker.getRegistration()
  const subscription = await registration?.pushManager.getSubscription()
  if (!subscription) return
  await client.rpc('remove_push_subscription', { p_endpoint: subscription.endpoint })
  await subscription.unsubscribe()
}

function base64UrlToBytes(value: string): Uint8Array<ArrayBuffer> {
  const base64 = (value + '='.repeat((4 - value.length % 4) % 4)).replace(/-/g, '+').replace(/_/g, '/')
  const raw = atob(base64)
  const bytes = new Uint8Array(new ArrayBuffer(raw.length))
  for (let index = 0; index < raw.length; index++) bytes[index] = raw.charCodeAt(index)
  return bytes
}
