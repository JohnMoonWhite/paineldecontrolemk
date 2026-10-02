import { describe, expect, it, vi } from 'vitest'
import { dispatchNotifications } from './push-dispatch'

const phone = { endpoint: 'https://push/phone', p256dh: 'k1', auth: 'a1', user_id: 'ana' }
const laptop = { endpoint: 'https://push/laptop', p256dh: 'k2', auth: 'a2', user_id: 'bia' }

function deps(overrides: Partial<Parameters<typeof dispatchNotifications>[0]> = {}) {
  return {
    loadPending: vi.fn().mockResolvedValue([
      { id: 1, kind: 'payment', title: 'Novo pagamento recebido', body: 'R$ 49,90 · JGH', url: '/#cash', target_user: null },
      { id: 2, kind: 'test', title: 'Notificações ativadas', body: 'ok', url: '/#cash', target_user: 'bia' },
    ]),
    loadSubscriptions: vi.fn().mockResolvedValue([phone, laptop]),
    send: vi.fn().mockResolvedValue('sent'),
    removeSubscription: vi.fn().mockResolvedValue(undefined),
    markSent: vi.fn().mockResolvedValue(undefined),
    ...overrides,
  }
}

describe('dispatchNotifications', () => {
  it('sends shared notifications to every device and targeted ones only to their user', async () => {
    const d = deps()
    const result = await dispatchNotifications(d)

    expect(d.send).toHaveBeenCalledTimes(3)
    expect(d.send).toHaveBeenCalledWith(laptop, expect.stringContaining('Notificações ativadas'))
    expect(d.send).not.toHaveBeenCalledWith(phone, expect.stringContaining('Notificações ativadas'))
    expect(d.markSent).toHaveBeenCalledWith([1, 2])
    expect(result).toEqual({ notifications: 2, delivered: 3, removed: 0, failed: 0 })
  })

  it('forgets devices whose subscription no longer exists', async () => {
    const d = deps({ send: vi.fn(async target => (target === phone ? 'gone' : 'sent')) })
    const result = await dispatchNotifications(d)

    expect(d.removeSubscription).toHaveBeenCalledWith(phone.endpoint)
    expect(d.removeSubscription).toHaveBeenCalledTimes(1)
    expect(result.removed).toBe(1)
  })

  it('does nothing when there is nothing pending', async () => {
    const d = deps({ loadPending: vi.fn().mockResolvedValue([]) })
    await expect(dispatchNotifications(d)).resolves.toEqual({ notifications: 0, delivered: 0, removed: 0, failed: 0 })
    expect(d.loadSubscriptions).not.toHaveBeenCalled()
    expect(d.markSent).not.toHaveBeenCalled()
  })
})
