import { useCallback, useEffect, useState } from 'react'
import { LoginPage } from './features/auth/LoginPage'
import { AuthLayout } from './features/auth/AuthLayout'
import { PasswordRecoveryPage } from './features/auth/PasswordRecoveryPage'
import { SetPasswordPage } from './features/auth/SetPasswordPage'
import { passwordRecoveryErrorMessage } from './features/auth/recovery-flow'
import { ExecutiveDashboard } from './features/dashboard/ExecutiveDashboard'
import { getSupabaseClient } from './lib/supabase'
import './index.css'

function App() {
  const [signedIn, setSignedIn] = useState(false)
  const [error, setError] = useState<string | null>(null)
  const [pending, setPending] = useState(false)
  const [screen, setScreen] = useState<'login' | 'request-password' | 'set-password'>('login')
  const [recoverySent, setRecoverySent] = useState(false)

  const refreshSession = useCallback(async () => {
    const supabase = getSupabaseClient()
    if (!supabase) return
    const { data: { session } } = await supabase.auth.getSession()
    setSignedIn(Boolean(session))
  }, [])

  async function signIn(email: string, password: string) {
    const supabase = getSupabaseClient()
    if (!supabase) { setError('A configuração segura do painel ainda não está disponível.'); return }
    setPending(true); setError(null)
    const { error: signInError } = await supabase.auth.signInWithPassword({ email, password })
    if (signInError) setError('Não foi possível entrar com estes dados.')
    else await refreshSession()
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

  async function setNewPassword(password: string) {
    const supabase = getSupabaseClient()
    if (!supabase) { setError('A configuração segura do painel ainda não está disponível.'); return }
    setPending(true); setError(null)
    const { error: updateError } = await supabase.auth.updateUser({ password })
    if (updateError) setError('Não foi possível salvar a nova senha. Solicite outro link e tente novamente.')
    else { setScreen('login'); await refreshSession() }
    setPending(false)
  }

  async function signOut() {
    await getSupabaseClient()?.auth.signOut()
    setError(null); setScreen('login'); setRecoverySent(false); setSignedIn(false)
  }

  useEffect(() => {
    const supabase = getSupabaseClient()
    if (!supabase) return
    const { data: { subscription } } = supabase.auth.onAuthStateChange((event) => {
      // Auth callbacks run while the client holds its session lock.
      // Defer further Auth calls until the callback has returned.
      if (event === 'PASSWORD_RECOVERY') { setError(null); setScreen('set-password') }
      else if (event === 'INITIAL_SESSION' || event === 'SIGNED_IN' || event === 'TOKEN_REFRESHED') {
        window.setTimeout(() => { void refreshSession() }, 0)
      } else if (event === 'SIGNED_OUT') { setSignedIn(false); setScreen('login') }
    })
    return () => subscription.unsubscribe()
  }, [refreshSession])

  if (screen === 'request-password') return <AuthLayout><PasswordRecoveryPage error={error} onBack={() => { setError(null); setRecoverySent(false); setScreen('login') }} onRequest={requestPasswordRecovery} pending={pending} sent={recoverySent} /></AuthLayout>
  if (screen === 'set-password') return <AuthLayout><SetPasswordPage error={error} onSetPassword={setNewPassword} pending={pending} /></AuthLayout>
  if (signedIn) return <ExecutiveDashboard onSignOut={signOut} />
  return <AuthLayout><LoginPage error={error} onRecoverPassword={() => { setError(null); setScreen('request-password') }} onSignIn={signIn} pending={pending} /></AuthLayout>
}

export default App
