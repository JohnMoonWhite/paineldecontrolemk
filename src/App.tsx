import { useCallback, useEffect, useRef, useState } from 'react'
import { LoginPage } from './features/auth/LoginPage'
import { MfaChallengePage } from './features/auth/MfaChallengePage'
import { MfaEnrollmentPage } from './features/auth/MfaEnrollmentPage'
import { PasswordRecoveryPage } from './features/auth/PasswordRecoveryPage'
import { SetPasswordPage } from './features/auth/SetPasswordPage'
import { accessStep, type AccessState, type AssuranceLevel } from './features/auth/auth-guard'
import { mfaQrImageSource } from './features/auth/mfa-qr'
import { passwordRecoveryErrorMessage, recoveryAccessStep } from './features/auth/recovery-flow'
import { ExecutiveDashboard } from './features/dashboard/ExecutiveDashboard'
import { getSupabaseClient } from './lib/supabase'
import './index.css'

function App() {
  const [access, setAccess] = useState<AccessState>({ session: false, currentAal: null, nextAal: null })
  const [error, setError] = useState<string | null>(null)
  const [factorId, setFactorId] = useState<string | null>(null)
  const [pending, setPending] = useState(false)
  const [qrCode, setQrCode] = useState<string | null>(null)
  const [setupKey, setSetupKey] = useState<string | null>(null)
  const enrollmentInFlight = useRef(false)
  const [screen, setScreen] = useState<'login' | 'request-password' | 'recover-mfa' | 'set-password'>('login')
  const [recoverySent, setRecoverySent] = useState(false)

  const refreshAccess = useCallback(async () => {
    const supabase = getSupabaseClient()
    if (!supabase) return
    const { data: { session } } = await supabase.auth.getSession()
    if (!session) { setAccess({ session: false, currentAal: null, nextAal: null }); return }
    const { data, error: assuranceError } = await supabase.auth.mfa.getAuthenticatorAssuranceLevel()
    if (assuranceError) { setError('Não foi possível confirmar a proteção da conta.'); return }
    setAccess({ session: true, currentAal: toAal(data.currentLevel), nextAal: toAal(data.nextLevel) })
  }, [])

  async function signIn(email: string, password: string) {
    const supabase = getSupabaseClient()
    if (!supabase) { setError('A configuração segura do painel ainda não está disponível.'); return }
    setPending(true); setError(null)
    const { error: signInError } = await supabase.auth.signInWithPassword({ email, password })
    if (signInError) setError('Não foi possível entrar com estes dados.')
    else await refreshAccess()
    setPending(false)
  }

  async function requestPasswordRecovery(email: string) {
    const supabase = getSupabaseClient()
    if (!supabase) { setError('A configuração segura do painel ainda não está disponível.'); return }
    setPending(true); setError(null)
    const { error: resetError } = await supabase.auth.resetPasswordForEmail(email, { redirectTo: window.location.origin })
    if (resetError) setError(passwordRecoveryErrorMessage(resetError.status))
    else setRecoverySent(true)
    setPending(false)
  }

  async function preparePasswordRecovery() {
    const supabase = getSupabaseClient()
    if (!supabase) return
    setPending(true); setError(null)
    const { data, error: assuranceError } = await supabase.auth.mfa.getAuthenticatorAssuranceLevel()
    if (assuranceError) setError('Não foi possível confirmar a proteção da conta.')
    else setScreen(recoveryAccessStep(toAal(data.nextLevel)) === 'verify-mfa' ? 'recover-mfa' : 'set-password')
    setPending(false)
  }

  async function verifyRecoveryChallenge(code: string) {
    const supabase = getSupabaseClient(); if (!supabase) return
    setPending(true); setError(null)
    const { data: factors, error: factorsError } = await supabase.auth.mfa.listFactors()
    const factor = factors?.totp[0]
    if (factorsError || !factor) setError('Não encontramos um autenticador ativo para esta conta.')
    else {
      const { data: challenge, error: challengeError } = await supabase.auth.mfa.challenge({ factorId: factor.id })
      if (challengeError) setError('Não foi possível confirmar o código agora.')
      else {
        const { error: verifyError } = await supabase.auth.mfa.verify({ factorId: factor.id, challengeId: challenge.id, code })
        if (verifyError) setError('O código não foi aceito. Tente o código atual.')
        else { setScreen('set-password'); await refreshAccess() }
      }
    }
    setPending(false)
  }

  async function setNewPassword(password: string) {
    const supabase = getSupabaseClient()
    if (!supabase) { setError('A configuração segura do painel ainda não está disponível.'); return }
    setPending(true); setError(null)
    const { error: updateError } = await supabase.auth.updateUser({ password })
    if (updateError) setError('Não foi possível salvar a nova senha. Solicite outro link e tente novamente.')
    else { setScreen('login'); await refreshAccess() }
    setPending(false)
  }

  async function startEnrollment() {
    const supabase = getSupabaseClient(); if (!supabase || enrollmentInFlight.current || qrCode) return
    enrollmentInFlight.current = true
    setPending(true); setError(null)
    try {
      const { data: factors, error: factorsError } = await supabase.auth.mfa.listFactors()
      if (factorsError) { setError(mfaErrorMessage(factorsError)); return }
      if (factors.totp.some(factor => factor.status === 'verified')) { await refreshAccess(); return }
      // Reloading loses the QR secret. Replace only this app's unfinished setup.
      for (const factor of factors.all) {
        if (factor.factor_type !== 'totp' || factor.status !== 'unverified' || factor.friendly_name !== 'Painel de Controle') continue
        const { error: removeError } = await supabase.auth.mfa.unenroll({ factorId: factor.id })
        if (removeError) { setError('Não foi possível reiniciar o cadastro incompleto. Saia da conta, entre novamente e tente gerar o QR.'); return }
      }
      const { data, error: enrollError } = await supabase.auth.mfa.enroll({ factorType: 'totp', friendlyName: 'Painel de Controle', issuer: 'MKHUB' })
      if (enrollError) setError(mfaErrorMessage(enrollError))
      else { setFactorId(data.id); setQrCode(mfaQrImageSource(data.totp.qr_code)); setSetupKey(data.totp.secret) }
    } catch {
      setError('A conexão foi interrompida. Confira sua internet e tente gerar o QR novamente.')
    } finally {
      enrollmentInFlight.current = false
      setPending(false)
    }
  }

  async function verifyEnrollment(code: string) {
    const supabase = getSupabaseClient(); if (!supabase || !factorId) return
    setPending(true); setError(null)
    const { data: challenge, error: challengeError } = await supabase.auth.mfa.challenge({ factorId })
    if (challengeError) setError('Não foi possível confirmar o código agora.')
    else {
      const { error: verifyError } = await supabase.auth.mfa.verify({ factorId, challengeId: challenge.id, code })
      if (verifyError) setError(mfaErrorMessage(verifyError))
      else { setSetupKey(null); setQrCode(null); setFactorId(null); await refreshAccess() }
    }
    setPending(false)
  }

  async function verifyChallenge(code: string) {
    const supabase = getSupabaseClient(); if (!supabase) return
    setPending(true); setError(null)
    const { data: factors, error: factorsError } = await supabase.auth.mfa.listFactors()
    const factor = factors?.totp[0]
    if (factorsError || !factor) setError('Não encontramos um autenticador ativo para esta conta.')
    else {
      const { data: challenge, error: challengeError } = await supabase.auth.mfa.challenge({ factorId: factor.id })
      if (challengeError) setError('Não foi possível confirmar o código agora.')
      else {
        const { error: verifyError } = await supabase.auth.mfa.verify({ factorId: factor.id, challengeId: challenge.id, code })
        if (verifyError) setError('O código não foi aceito. Tente o código atual.')
        else await refreshAccess()
      }
    }
    setPending(false)
  }

  async function signOut() {
    await getSupabaseClient()?.auth.signOut()
    setError(null); setFactorId(null); setQrCode(null); setSetupKey(null)
    setScreen('login'); setRecoverySent(false)
    setAccess({ session: false, currentAal: null, nextAal: null })
  }

  useEffect(() => {
    const supabase = getSupabaseClient()
    if (!supabase) return
    const { data: { subscription } } = supabase.auth.onAuthStateChange((event) => {
      if (event === 'INITIAL_SESSION') void refreshAccess()
      if (event === 'PASSWORD_RECOVERY') void preparePasswordRecovery()
    })
    return () => subscription.unsubscribe()
  }, [refreshAccess])

  const step = accessStep(access)
  if (screen === 'request-password') return <main className="access-shell"><PasswordRecoveryPage error={error} onBack={() => { setError(null); setRecoverySent(false); setScreen('login') }} onRequest={requestPasswordRecovery} pending={pending} sent={recoverySent} /></main>
  if (screen === 'recover-mfa') return <main className="access-shell"><MfaChallengePage error={error} onVerify={verifyRecoveryChallenge} pending={pending} /></main>
  if (screen === 'set-password') return <main className="access-shell"><SetPasswordPage error={error} onSetPassword={setNewPassword} pending={pending} /></main>
  if (step === 'enroll-mfa') return <main className="access-shell"><MfaEnrollmentPage key={factorId} error={error} onEnable={verifyEnrollment} onStart={startEnrollment} onSignOut={signOut} pending={pending} qrCode={qrCode} setupKey={setupKey} /></main>
  if (step === 'challenge-mfa') return <main className="access-shell"><MfaChallengePage error={error} onVerify={verifyChallenge} pending={pending} /></main>
  if (step === 'dashboard') return <ExecutiveDashboard onSignOut={signOut} />
  return <main className="access-shell"><LoginPage error={error} onRecoverPassword={() => { setError(null); setScreen('request-password') }} onSignIn={signIn} pending={pending} /></main>
}

function toAal(value: string | null | undefined): AssuranceLevel { return value === 'aal1' || value === 'aal2' ? value : null }

function mfaErrorMessage(error: { code?: string; status?: number }): string {
  if (error.status === 429 || error.code === 'over_request_rate_limit') return 'Muitas tentativas em sequência. Aguarde um minuto antes de tentar novamente.'
  if (error.status === 401 || error.code === 'session_not_found' || error.code === 'refresh_token_not_found') return 'Sua sessão expirou. Saia da conta e entre novamente.'
  if (error.code === 'mfa_factor_name_conflict') return 'Há outro cadastro em andamento. Feche as outras abas do painel e tente novamente.'
  if (error.code === 'mfa_verification_failed') return 'O código não corresponde a este QR. Cadastre este QR como uma nova conta no autenticador, ative a hora automática do celular e use o próximo código.'
  if (error.code === 'mfa_factor_not_found') return 'Este QR não está mais ativo. Saia da conta e entre novamente para gerar outro.'
  return 'Não foi possível preparar o autenticador. Confira a conexão e tente novamente.'
}

export default App
