import { describe, expect, it } from 'vitest'
import { passwordRecoveryErrorMessage, recoveryAccessStep } from './recovery-flow'

describe('recoveryAccessStep', () => {
  it('requires the existing authenticator before changing a password when MFA is enrolled', () => {
    expect(recoveryAccessStep('aal2')).toBe('verify-mfa')
  })

  it('allows a recovered session without an enrolled factor to continue to the password form', () => {
    expect(recoveryAccessStep(null)).toBe('set-password')
  })
})

describe('passwordRecoveryErrorMessage', () => {
  it('explains the temporary wait when Auth rate-limits a new recovery email', () => {
    expect(passwordRecoveryErrorMessage(429)).toBe('Aguarde um minuto antes de pedir outro link.')
  })
})
