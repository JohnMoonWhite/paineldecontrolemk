import { useEffect, useState } from 'react'
import { Icon } from '../../components/Icon'
import { currentPushState, disablePush, enablePush, type PushState } from '../../lib/push'
import { getSupabaseClient } from '../../lib/supabase'

const labels: Record<Exclude<PushState, 'unsupported'>, string> = {
  off: 'Ativar notificações',
  on: 'Notificações ativas',
  denied: 'Notificações bloqueadas',
  'needs-install': 'Instale o app para receber notificações',
}

const hints: Partial<Record<PushState, string>> = {
  on: 'Toque para parar de receber notificações neste aparelho.',
  denied: 'Libere as notificações deste site nas configurações do navegador ou do celular.',
  'needs-install': 'No iPhone, toque em Compartilhar › Adicionar à Tela de Início e abra o MKHub por lá.',
}

/** Bell in the header: subscribes this device to payment and ledger notifications. */
export function NotificationToggle() {
  const [state, setState] = useState<PushState | null>(null)
  const [busy, setBusy] = useState(false)
  const [message, setMessage] = useState<string | null>(null)

  useEffect(() => { void currentPushState().then(setState).catch(() => setState('unsupported')) }, [])

  if (!state || state === 'unsupported') return null

  async function toggle() {
    const client = getSupabaseClient()
    if (!client) return
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
  }

  const label = labels[state]
  return <div className="push-toggle">
    <button className={`nav-link push-button push-button--${state}`} type="button" disabled={busy || state === 'denied'} title={hints[state] ?? label}
      aria-label={label} onClick={() => state === 'needs-install' ? setMessage(hints['needs-install']!) : void toggle()}>
      <Icon name="bell" /><span>{busy ? 'Aguarde…' : label}</span>
    </button>
    {message ? <p className="push-message" role="status">{message}</p> : null}
  </div>
}
