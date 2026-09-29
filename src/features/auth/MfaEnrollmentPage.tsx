import { useState } from 'react'
import type { FormEvent } from 'react'

type MfaEnrollmentPageProps = {
  error: string | null
  onEnable: (code: string) => void
  onStart: () => void
  pending: boolean
  qrCode: string | null
}

export function MfaEnrollmentPage({ error, onEnable, onStart, pending, qrCode }: MfaEnrollmentPageProps) {
  const [code, setCode] = useState('')
  function submit(event: FormEvent<HTMLFormElement>) { event.preventDefault(); onEnable(code.trim()) }

  return (
    <section className="auth-card" aria-labelledby="mfa-title">
      <p className="product-mark">Proteção da conta</p>
      <h1 id="mfa-title">Proteja o acesso.</h1>
      <p className="auth-copy">Use Google Authenticator, 1Password ou outro aplicativo compatível para escanear o código.</p>
      {!qrCode ? <button className="access-button" disabled={pending} onClick={onStart} type="button">{pending ? 'Preparando…' : 'Gerar código de segurança'}</button> : (
        <form className="auth-form" onSubmit={submit}>
          <img alt="Código QR para configurar o autenticador" className="mfa-qr" src={qrCode} />
          <label>Código de 6 dígitos<input autoComplete="one-time-code" inputMode="numeric" maxLength={6} onChange={(event) => setCode(event.target.value)} pattern="[0-9]{6}" required value={code} /></label>
          <button className="access-button" disabled={pending} type="submit">{pending ? 'Confirmando…' : 'Confirmar código'}</button>
        </form>
      )}
      {error ? <p className="form-error" role="alert">{error}</p> : null}
    </section>
  )
}
