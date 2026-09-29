import { useState } from 'react'
import type { FormEvent } from 'react'

type SetPasswordPageProps = {
  error: string | null
  onSetPassword: (password: string) => void
  pending: boolean
}

export function SetPasswordPage({ error, onSetPassword, pending }: SetPasswordPageProps) {
  const [password, setPassword] = useState('')
  const [confirmation, setConfirmation] = useState('')
  const [validationError, setValidationError] = useState<string | null>(null)

  function submit(event: FormEvent<HTMLFormElement>) {
    event.preventDefault()
    if (password !== confirmation) { setValidationError('As senhas não coincidem.'); return }
    setValidationError(null)
    onSetPassword(password)
  }

  return (
    <section className="auth-card" aria-labelledby="set-password-title">
      <p className="product-mark">Painel de Controle</p>
      <h1 id="set-password-title">Crie sua nova senha</h1>
      <p className="auth-copy">Use uma senha longa e exclusiva para este painel.</p>
      <form className="auth-form" onSubmit={submit}>
        <label>
          Nova senha
          <input autoComplete="new-password" disabled={pending} minLength={12} name="new-password" onChange={(event) => setPassword(event.target.value)} required type="password" value={password} />
        </label>
        <label>
          Confirmar nova senha
          <input autoComplete="new-password" disabled={pending} minLength={12} name="confirm-password" onChange={(event) => setConfirmation(event.target.value)} required type="password" value={confirmation} />
        </label>
        {validationError || error ? <p className="form-error" role="alert">{validationError ?? error}</p> : null}
        <button className="access-button" disabled={pending} type="submit">{pending ? 'Salvando…' : 'Salvar nova senha'}</button>
      </form>
    </section>
  )
}
