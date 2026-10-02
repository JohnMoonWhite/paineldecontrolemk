import { fireEvent, render, screen } from '@testing-library/react'
import { vi } from 'vitest'
import { currentPushState, disablePush, enablePush } from '../../lib/push'
import { NotificationToggle } from './NotificationToggle'

vi.mock('../../lib/push', () => ({ currentPushState: vi.fn(), enablePush: vi.fn(), disablePush: vi.fn() }))
vi.mock('../../lib/supabase', () => ({ getSupabaseClient: () => ({}) }))

afterEach(() => vi.resetAllMocks())

it('turns notifications on for this device', async () => {
  vi.mocked(currentPushState).mockResolvedValue('off')
  vi.mocked(enablePush).mockResolvedValue()
  render(<NotificationToggle />)

  fireEvent.click(await screen.findByRole('button', { name: 'Ativar notificações' }))

  expect(await screen.findByRole('button', { name: 'Notificações ativas' })).toBeVisible()
  expect(enablePush).toHaveBeenCalledOnce()
})

it('turns them off when they are active', async () => {
  vi.mocked(currentPushState).mockResolvedValue('on')
  vi.mocked(disablePush).mockResolvedValue()
  render(<NotificationToggle />)

  fireEvent.click(await screen.findByRole('button', { name: 'Notificações ativas' }))

  expect(await screen.findByRole('button', { name: 'Ativar notificações' })).toBeVisible()
  expect(disablePush).toHaveBeenCalledOnce()
})

it('explains when the browser blocked notifications', async () => {
  vi.mocked(currentPushState).mockResolvedValue('denied')
  render(<NotificationToggle />)

  expect(await screen.findByRole('button', { name: 'Notificações bloqueadas' })).toBeDisabled()
})

it('stays hidden where push is not available', async () => {
  vi.mocked(currentPushState).mockResolvedValue('unsupported')
  const { container } = render(<NotificationToggle />)

  await vi.waitFor(() => expect(currentPushState).toHaveBeenCalled())
  expect(container).toBeEmptyDOMElement()
})
