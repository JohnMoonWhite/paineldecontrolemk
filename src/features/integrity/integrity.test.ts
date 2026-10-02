import { describe, expect, it } from 'vitest'
import { siteStatus, summarizeIntegrity, type SiteHealth } from './integrity'

const now = new Date('2026-10-02T15:00:00Z')
const site = (overrides: Partial<SiteHealth>): SiteHealth => ({
  id: 'x', name: 'Site', url: 'https://site.dev', kind: 'site', sort: 0, checked_at: '2026-10-02T14:58:00Z',
  state: 'online', status_code: 200, latency_ms: 80, uptime_24h: 100, uptime_30d: 100, avg_latency_24h: 90, trend: [], ...overrides,
})

describe('siteStatus', () => {
  it('reads the latest check and marks a site whose checks stopped', () => {
    expect(siteStatus(site({}), now)).toBe('online')
    expect(siteStatus(site({ state: 'slow' }), now)).toBe('slow')
    expect(siteStatus(site({ checked_at: '2026-10-02T14:30:00Z' }), now)).toBe('unknown')
    expect(siteStatus(site({ checked_at: null, state: null }), now)).toBe('unknown')
  })
})

describe('summarizeIntegrity', () => {
  it('reports everything normal when all sites answer', () => {
    expect(summarizeIntegrity([site({ id: 'a' }), site({ id: 'b', uptime_30d: 99.5 })], now)).toEqual(
      expect.objectContaining({ total: 2, online: 2, attention: 0, offline: 0, overall: 'ok', uptime30d: 99.75 }),
    )
  })

  it('escalates to attention for slow or silent sites and to down when one is offline', () => {
    expect(summarizeIntegrity([site({ id: 'a' }), site({ id: 'b', state: 'slow' })], now).overall).toBe('attention')
    expect(summarizeIntegrity([site({ id: 'a', checked_at: null, state: null })], now).overall).toBe('attention')
    expect(summarizeIntegrity([site({ id: 'a' }), site({ id: 'b', state: 'offline' })], now)).toEqual(
      expect.objectContaining({ offline: 1, overall: 'down' }),
    )
  })
})
