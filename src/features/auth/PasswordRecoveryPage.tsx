import { useState } from 'react'
import type { FormEvent } from 'react'

type PasswordRecoveryPageProps = {
  error: string | null
  onBack: () => void
  onRequest: (email: string) => void
  pending: boolean
  sent: boolean
}

export function PasswordRecoveryPage({ error, onBack, onRequest, pending, sent }: PasswordRecoveryPageProps) {
  const [email, setEmail] = useState('')

  function submit(event: FormEvent<HTMLFormElement>) {
    event.preventDefault()
    onRequest(email.trim())
  }

  return (
    <section className="auth-card" aria-labelledby="recovery-title">
      <p className="product-mark">Painel de Controle</p>
      <h1 id="recovery-title">Recupere sua senha</h1>
      <p className="auth-copy">Enviaremos um link seguro para você criar uma nova senha.</p>
      {sent ? <p className="form-success" role="status">Se houver uma conta com este e-mail, o link de recuperação chegará em instantes.</p> : (
        <form className="auth-form" onSubmit={submit}>
          <label>
            E-mail
            <input autoComplete="email" disabled={pending} name="email" onChange={(event) => setEmail(event.target.value)} required type="email" value={email} />
          </label>
          {error ? <p className="form-error" role="alert">{error}</p> : null}
          <button className="access-button" disabled={pending} type="submit">{pending ? 'Enviando…' : 'Enviar link seguro'}</button>
        </form>
      )}
      <button className="text-button" disabled={pending} onClick={onBack} type="button">Voltar para entrar</button>
    </section>
  )
}
