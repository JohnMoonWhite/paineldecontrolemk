import { useState } from 'react'
import type { FormEvent } from 'react'

type LoginPageProps = {
  onSignIn: (email: string, password: string) => void
  pending: boolean
  error: string | null
}

export function LoginPage({ onSignIn, pending, error }: LoginPageProps) {
  const [email, setEmail] = useState('')
  const [password, setPassword] = useState('')

  function submit(event: FormEvent<HTMLFormElement>) {
    event.preventDefault()
    onSignIn(email.trim(), password)
  }

  return (
    <section className="auth-card" aria-labelledby="login-title">
      <p className="product-mark">Painel de Controle</p>
      <h1 id="login-title">Veja o negócio com clareza.</h1>
      <p className="auth-copy">Entre para acompanhar assinaturas, uso e sinais de atenção em um único lugar.</p>
      <form className="auth-form" onSubmit={submit}>
        <label>
          E-mail
          <input autoComplete="email" disabled={pending} name="email" onChange={(event) => setEmail(event.target.value)} required type="email" value={email} />
        </label>
        <label>
          Senha
          <input autoComplete="current-password" disabled={pending} name="password" onChange={(event) => setPassword(event.target.value)} required type="password" value={password} />
        </label>
        {error ? <p className="form-error" role="alert">{error}</p> : null}
        <button className="access-button" disabled={pending} type="submit">{pending ? 'Verificando…' : 'Entrar'}</button>
      </form>
      <p className="access-note">Depois da senha, confirmamos o código do seu autenticador.</p>
    </section>
  )
}
