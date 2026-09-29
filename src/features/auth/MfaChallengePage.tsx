import { useState } from 'react'
import type { FormEvent } from 'react'

type MfaChallengePageProps = { error: string | null; onVerify: (code: string) => void; pending: boolean }

export function MfaChallengePage({ error, onVerify, pending }: MfaChallengePageProps) {
  const [code, setCode] = useState('')
  function submit(event: FormEvent<HTMLFormElement>) { event.preventDefault(); onVerify(code.trim()) }
  return <section className="auth-card" aria-labelledby="challenge-title"><p className="product-mark">Confirmação necessária</p><h1 id="challenge-title">Digite o código.</h1><p className="auth-copy">Abra seu aplicativo autenticador e informe o código atual.</p><form className="auth-form" onSubmit={submit}><label>Código de 6 dígitos<input autoComplete="one-time-code" inputMode="numeric" maxLength={6} onChange={(event) => setCode(event.target.value)} pattern="[0-9]{6}" required value={code} /></label>{error ? <p className="form-error" role="alert">{error}</p> : null}<button className="access-button" disabled={pending} type="submit">{pending ? 'Confirmando…' : 'Confirmar código'}</button></form></section>
}
