export type AssuranceLevel = 'aal1' | 'aal2' | null

export type AccessState = {
  session: boolean
  currentAal: AssuranceLevel
  nextAal: AssuranceLevel
}

export type AccessStep = 'sign-in' | 'enroll-mfa' | 'challenge-mfa' | 'dashboard'

export function accessStep(state: AccessState): AccessStep {
  if (!state.session) {
    return 'sign-in'
  }

  if (state.currentAal === 'aal2') {
    return 'dashboard'
  }

  return state.nextAal === 'aal2' ? 'challenge-mfa' : 'enroll-mfa'
}
