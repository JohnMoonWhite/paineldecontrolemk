import { fireEvent, render, screen } from '@testing-library/react'
import { vi } from 'vitest'
import { currentPushState, disablePush, enablePush } from '../../lib/push'
import { NotificationToggle, PushInvite } from './NotificationToggle'
import { usePushNotifications } from './usePushNotifications'

vi.mock('../../lib/push', () => ({ currentPushState: vi.fn(), enablePush: vi.fn(), disablePush: vi.fn() }))
vi.mock('../../lib/supabase', () => ({ getSupabaseClient: () => ({}) }))

function Harness() {
  const push = usePushNotifications()
  return <><NotificationToggle push={push} /><PushInvite push={push} /></>
}

afterEach(() => { vi.resetAllMocks(); localStorage.clear() })

it('invites the user to turn notifications on and updates the bell once they do', async () => {
  vi.mocked(currentPushState).mockResolvedValue('off')
  vi.mocked(enablePush).mockResolvedValue()
  render(<Harness />)

  expect(await screen.findByText('Receba no celular cada pagamento e lançamento')).toBeVisible()
  fireEvent.click(screen.getAllByRole('button', { name: 'Ativar notificações' })[1])

  expect(await screen.findByRole('button', { name: 'Notificações ativas' })).toBeVisible()
  expect(screen.queryByText('Receba no celular cada pagamento e lançamento')).not.toBeInTheDocument()
  expect(enablePush).toHaveBeenCalledOnce()
})

it('remembers when the invite is dismissed', async () => {
  vi.mocked(currentPushState).mockResolvedValue('off')
  const { unmount } = render(<Harness />)

  fireEvent.click(await screen.findByRole('button', { name: 'Agora não' }))
  expect(screen.queryByText('Receba no celular cada pagamento e lançamento')).not.toBeInTheDocument()
  unmount()

  render(<Harness />)
  await screen.findByRole('button', { name: 'Ativar notificações' })
  expect(screen.queryByText('Receba no celular cada pagamento e lançamento')).not.toBeInTheDocument()
})

it('turns notifications off from the bell', async () => {
  vi.mocked(currentPushState).mockResolvedValue('on')
  vi.mocked(disablePush).mockResolvedValue()
  render(<Harness />)

  fireEvent.click(await screen.findByRole('button', { name: 'Notificações ativas' }))

  expect(await screen.findAllByRole('button', { name: 'Ativar notificações' })).not.toHaveLength(0)
  expect(disablePush).toHaveBeenCalledOnce()
})

it('explains how to install the app on iPhone', async () => {
  vi.mocked(currentPushState).mockResolvedValue('needs-install')
  render(<Harness />)

  expect(await screen.findByText(/Adicionar à Tela de Início/)).toBeVisible()
})

it('shows nothing where push is not available', async () => {
  vi.mocked(currentPushState).mockResolvedValue('unsupported')
  const { container } = render(<Harness />)

  await vi.waitFor(() => expect(currentPushState).toHaveBeenCalled())
  expect(container).toBeEmptyDOMElement()
})
