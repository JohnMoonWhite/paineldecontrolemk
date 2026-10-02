import { useCallback, useEffect, useState } from 'react'
import { currentPushState, disablePush, enablePush, type PushState } from '../../lib/push'
import { getSupabaseClient } from '../../lib/supabase'

const dismissedKey = 'mkhub.push-invite-dismissed'

function readDismissed() {
  try { return localStorage.getItem(dismissedKey) === '1' } catch { return false }
}

/** Push state of this device, shared by the header bell and the invite card. */
export function usePushNotifications() {
  const [state, setState] = useState<PushState | null>(null)
  const [busy, setBusy] = useState(false)
  const [message, setMessage] = useState<string | null>(null)
  const [dismissed, setDismissed] = useState(readDismissed)

  useEffect(() => { void currentPushState().then(setState).catch(() => setState('unsupported')) }, [])

  // Browsers only ask for permission after a tap, so this always runs from a button.
  const toggle = useCallback(async () => {
    const client = getSupabaseClient()
    if (!client || !state) return
    setBusy(true); setMessage(null)
    try {
      if (state === 'on') { await disablePush(client); setState('off') }
      else { await enablePush(client); setState('on') }
    } catch (cause) {
      setMessage(cause instanceof Error ? cause.message : 'Não foi possível alterar as notificações.')
      setState(await currentPushState().catch(() => 'off' as const))
    } finally {
      setBusy(false)
    }
  }, [state])

  const dismiss = useCallback(() => {
    setDismissed(true)
    try { localStorage.setItem(dismissedKey, '1') } catch { /* the invite simply shows again next time */ }
  }, [])

  return { state, busy, message, dismissed, toggle, dismiss, setMessage }
}

export type PushNotifications = ReturnType<typeof usePushNotifications>
