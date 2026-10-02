export type SiteState = 'online' | 'slow' | 'offline'
export type Expectation = 'ok' | 'reachable'
export type Probe = { status: number | null; latencyMs: number | null; error?: string | null }

/** Answers slower than this still count as available but are flagged. */
export const slowThresholdMs = 2500

export function classifyCheck(expectation: Expectation, probe: Probe): SiteState {
  if (probe.status === null) return 'offline'
  const answered = expectation === 'reachable' ? probe.status < 500 : probe.status >= 200 && probe.status < 400
  if (!answered) return 'offline'
  return (probe.latencyMs ?? 0) > slowThresholdMs ? 'slow' : 'online'
}
