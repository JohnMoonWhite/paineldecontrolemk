/** One monitored site as returned by the monitoring_site_health view. */
export type SiteHealth = {
  id: string
  name: string
  url: string
  kind: 'site' | 'api' | 'database'
  sort: number
  checked_at: string | null
  state: 'online' | 'slow' | 'offline' | null
  status_code: number | null
  latency_ms: number | null
  // Postgres numerics arrive as strings.
  uptime_24h: number | string | null
  uptime_30d: number | string | null
  avg_latency_24h: number | null
  /** Recent checks, oldest first: [latency in ms or null, state]. */
  trend: [number | null, string][]
}

export type SiteStatus = 'online' | 'slow' | 'offline' | 'unknown'

export type IntegritySummary = {
  total: number
  online: number
  attention: number
  offline: number
  overall: 'ok' | 'attention' | 'down' | 'empty'
  uptime30d: number | null
}

/** Checks run every five minutes; a site silent for longer than this means monitoring stopped. */
const staleAfterMs = 15 * 60000

export function siteStatus(site: SiteHealth, now: Date): SiteStatus {
  if (!site.state || !site.checked_at) return 'unknown'
  if (now.getTime() - Date.parse(site.checked_at) > staleAfterMs) return 'unknown'
  return site.state
}

export function percent(value: number | string | null): number | null {
  if (value === null) return null
  const number = Number(value)
  return Number.isFinite(number) ? number : null
}

export function summarizeIntegrity(sites: SiteHealth[], now: Date): IntegritySummary {
  const statuses = sites.map(site => siteStatus(site, now))
  const online = statuses.filter(status => status === 'online').length
  const offline = statuses.filter(status => status === 'offline').length
  const attention = statuses.length - online - offline
  const uptimes = sites.map(site => percent(site.uptime_30d)).filter((value): value is number => value !== null)
  return {
    total: sites.length,
    online,
    attention,
    offline,
    overall: !sites.length ? 'empty' : offline ? 'down' : attention ? 'attention' : 'ok',
    uptime30d: uptimes.length ? Math.round(uptimes.reduce((sum, value) => sum + value, 0) / uptimes.length * 100) / 100 : null,
  }
}
