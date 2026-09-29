import { describe, expect, it } from 'vitest'
import { accessStep } from './auth-guard'

describe('accessStep', () => {
  it('requires sign-in before any dashboard access', () => {
    expect(accessStep({ session: false, currentAal: null, nextAal: null })).toBe('sign-in')
  })

  it('requires enrollment when no MFA factor can raise assurance', () => {
    expect(accessStep({ session: true, currentAal: 'aal1', nextAal: 'aal1' })).toBe('enroll-mfa')
  })

  it('requires a challenge when an enrolled factor can raise assurance', () => {
    expect(accessStep({ session: true, currentAal: 'aal1', nextAal: 'aal2' })).toBe('challenge-mfa')
  })

  it('allows the executive view only at AAL2', () => {
    expect(accessStep({ session: true, currentAal: 'aal2', nextAal: 'aal2' })).toBe('dashboard')
  })
})
