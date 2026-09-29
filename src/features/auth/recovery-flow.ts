import type { AssuranceLevel } from './auth-guard'

export function recoveryAccessStep(nextAal: AssuranceLevel): 'verify-mfa' | 'set-password' {
  return nextAal === 'aal2' ? 'verify-mfa' : 'set-password'
}

export function passwordRecoveryErrorMessage(status: number | undefined): string {
  return status === 429
    ? 'Aguarde um minuto antes de pedir outro link.'
    : 'Não foi possível enviar o link agora. Tente novamente em instantes.'
}
