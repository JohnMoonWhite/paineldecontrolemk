import { describe, expect, it } from 'vitest'
import { passwordRecoveryErrorMessage } from './recovery-flow'

describe('passwordRecoveryErrorMessage', () => {
  it('explains the temporary wait when Auth rate-limits a new recovery email', () => {
    expect(passwordRecoveryErrorMessage(429)).toBe('Aguarde um minuto antes de pedir outro link.')
  })
})
