import { Icon } from '../../components/Icon'
import type { PushNotifications } from './usePushNotifications'

const installHint = 'No iPhone, toque em Compartilhar › Adicionar à Tela de Início e abra o MKHub por lá para receber notificações.'

const bellLabels = {
  off: 'Ativar notificações',
  on: 'Notificações ativas',
  denied: 'Notificações bloqueadas',
  'needs-install': 'Instale o app para receber notificações',
} as const

const bellHints = {
  off: 'Receba cada pagamento e lançamento neste aparelho.',
  on: 'Toque para parar de receber notificações neste aparelho.',
  denied: 'Libere as notificações deste site nas configurações do navegador ou do celular.',
  'needs-install': installHint,
} as const

/** Header bell: shows and switches the notification state of this device. */
export function NotificationToggle({ push }: { push: PushNotifications }) {
  const { state, busy, message, toggle, setMessage } = push
  if (!state || state === 'unsupported') return null

  return <div className="push-toggle">
    <button className={`nav-link push-button push-button--${state}`} type="button" disabled={busy || state === 'denied'} title={bellHints[state]}
      aria-label={bellLabels[state]} onClick={() => state === 'needs-install' ? setMessage(installHint) : void toggle()}>
      <Icon name="bell" /><span>{busy ? 'Aguarde…' : bellLabels[state]}</span>
    </button>
    {message ? <p className="push-message" role="status">{message}</p> : null}
  </div>
}

/** Card at the top of the dashboard until the device has notifications or the user says no. */
export function PushInvite({ push }: { push: PushNotifications }) {
  const { state, busy, dismissed, toggle, dismiss } = push
  if (dismissed || (state !== 'off' && state !== 'needs-install')) return null

  return <div className="push-invite">
    <Icon name="bell" />
    <div>
      <strong>Receba no celular cada pagamento e lançamento</strong>
      <p>{state === 'needs-install' ? installHint : 'As notificações chegam mesmo com o app fechado. Ative uma vez em cada aparelho.'}</p>
    </div>
    {state === 'off' ? <button className="primary-button" type="button" disabled={busy} onClick={() => void toggle()} aria-label="Ativar notificações">{busy ? 'Aguarde…' : 'Ativar notificações'}</button> : null}
    <button className="text-button" type="button" onClick={dismiss}>Agora não</button>
  </div>
}
