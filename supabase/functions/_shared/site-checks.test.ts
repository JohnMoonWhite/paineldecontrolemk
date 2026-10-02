import { describe, expect, it } from 'vitest'
import { classifyCheck } from './site-checks'

describe('classifyCheck', () => {
  it('accepts success and redirect answers from sites', () => {
    expect(classifyCheck('ok', { status: 200, latencyMs: 120 })).toBe('online')
    expect(classifyCheck('ok', { status: 302, latencyMs: 120 })).toBe('online')
    expect(classifyCheck('ok', { status: 404, latencyMs: 120 })).toBe('offline')
  })

  it('accepts any non-server-error answer from APIs that require a key', () => {
    expect(classifyCheck('reachable', { status: 401, latencyMs: 90 })).toBe('online')
    expect(classifyCheck('reachable', { status: 503, latencyMs: 90 })).toBe('offline')
  })

  it('flags slow answers and failures without an answer', () => {
    expect(classifyCheck('ok', { status: 200, latencyMs: 3200 })).toBe('slow')
    expect(classifyCheck('ok', { status: null, latencyMs: null, error: 'timeout' })).toBe('offline')
  })
})
