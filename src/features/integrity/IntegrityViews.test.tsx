import { render, screen, within } from '@testing-library/react'
import { describe, expect, it } from 'vitest'
import { IntegrityPage, IntegritySummary } from './IntegrityViews'
import type { SiteHealth } from './integrity'

const now = new Date('2026-10-02T15:00:00Z')
const sites: SiteHealth[] = [
  { id: 'a', name: 'OrdemSync', url: 'https://ordemsync.pages.dev', kind: 'site', sort: 1, checked_at: '2026-10-02T14:58:00Z', state: 'online', status_code: 200, latency_ms: 668, uptime_24h: 100, uptime_30d: 99.98, avg_latency_24h: 600, trend: [[600, 'online'], [668, 'online']] },
  { id: 'b', name: 'Banco PMS', url: 'https://ref.supabase.co/auth/v1/health', kind: 'database', sort: 2, checked_at: '2026-10-02T14:58:00Z', state: 'offline', status_code: 503, latency_ms: null, uptime_24h: 90, uptime_30d: 98.21, avg_latency_24h: null, trend: [[200, 'online'], [null, 'offline']] },
]

describe('IntegritySummary', () => {
  it('fits the overall state in one line and links to the details', () => {
    render(<IntegritySummary sites={sites} now={now} />)

    expect(screen.getByText('1 fora do ar')).toBeVisible()
    expect(screen.getByText('1 de 2 online')).toBeVisible()
    expect(screen.getByRole('link', { name: /Ver detalhes/ })).toHaveAttribute('href', '#integridade')
  })
})

describe('IntegrityPage', () => {
  it('lists every site with its state, answer time, uptime and last check', () => {
    render(<IntegrityPage sites={sites} now={now} />)

    const ordemsync = screen.getByText('OrdemSync').closest('li')!
    expect(within(ordemsync).getByText('Online')).toBeVisible()
    expect(within(ordemsync).getByText('668 ms')).toBeVisible()
    expect(within(ordemsync).getByText('200 OK')).toBeVisible()
    expect(within(ordemsync).getByText('99,98%')).toBeVisible()
    expect(within(ordemsync).getByText('há 2 min')).toBeVisible()

    const database = screen.getByText('Banco PMS').closest('li')!
    expect(within(database).getByText('Fora do ar')).toBeVisible()
    expect(within(database).getByText('HTTP 503')).toBeVisible()
  })
})
