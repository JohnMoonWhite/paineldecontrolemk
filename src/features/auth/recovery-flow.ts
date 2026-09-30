export function passwordRecoveryErrorMessage(status: number | undefined): string {
  return status === 429
    ? 'Aguarde um minuto antes de pedir outro link.'
    : 'Não foi possível enviar o link agora. Tente novamente em instantes.'
}
