import { fireEvent, render, screen } from '@testing-library/react'
import { vi } from 'vitest'
import App from './App'
import { getSupabaseClient } from './lib/supabase'

vi.mock('./lib/supabase', () => ({ getSupabaseClient: vi.fn() }))

function setup({ removalFails = false, verified = false } = {}) {
  const factors = [
    { id: 'old', factor_type: 'totp', friendly_name: 'Painel de Controle', status: verified ? 'verified' : 'unverified' },
    { id: 'other', factor_type: 'totp', friendly_name: 'Outro aplicativo', status: 'unverified' },
  ]
  const mfa = {
    getAuthenticatorAssuranceLevel: async () => ({ data: { currentLevel: 'aal1', nextLevel: verified ? 'aal2' : 'aal1' }, error: null }),
    listFactors: async () => ({ data: { all: [...factors], totp: factors.filter(f => f.status === 'verified'), phone: [] }, error: null }),
    unenroll: async ({ factorId }: { factorId: string }) => {
      if (removalFails) return { error: { code: 'unexpected_failure' } }
      const index = factors.findIndex(f => f.id === factorId)
      if (index >= 0) factors.splice(index, 1)
      return { data: { id: factorId }, error: null }
    },
    enroll: async () => factors.some(f => f.friendly_name === 'Painel de Controle')
      ? { data: null, error: { code: 'mfa_factor_name_conflict' } }
      : { data: { id: 'new', totp: { qr_code: 'data:image/svg+xml;utf-8,test', secret: 'TEST-ONLY-SECRET', uri: 'otpauth://test' } }, error: null },
  }
  const client = { auth: {
    getSession: async () => ({ data: { session: { user: { id: 'user' } } }, error: null }),
    onAuthStateChange: (callback: (event: string) => void) => {
      setTimeout(() => callback('INITIAL_SESSION'), 0)
      return { data: { subscription: { unsubscribe() {} } } }
    },
    mfa,
  } }
  vi.mocked(getSupabaseClient).mockReturnValue(client as unknown as ReturnType<typeof getSupabaseClient>)
  return factors
}

describe('MFA enrollment recovery', () => {
  it('restarts an interrupted enrollment without deleting unrelated factors', async () => {
    const factors = setup()
    render(<App />)
    fireEvent.click(await screen.findByRole('button', { name: 'Gerar código de segurança' }))
    expect(await screen.findByAltText('Código QR para configurar o autenticador')).toBeInTheDocument()
    expect(factors.map(f => f.id)).toEqual(['other'])
  })

  it('does not create another factor when the interrupted enrollment cannot be removed', async () => {
    const factors = setup({ removalFails: true })
    render(<App />)
    fireEvent.click(await screen.findByRole('button', { name: 'Gerar código de segurança' }))
    expect(await screen.findByRole('alert')).toHaveTextContent(/reiniciar/i)
    expect(screen.queryByAltText('Código QR para configurar o autenticador')).not.toBeInTheDocument()
    expect(factors.map(f => f.id)).toEqual(['old', 'other'])
    expect(screen.getByRole('button', { name: 'Gerar código de segurança' })).toBeEnabled()
  })

  it('preserves verified protection and asks for a code instead of enrollment', async () => {
    const factors = setup({ verified: true })
    render(<App />)
    expect(await screen.findByRole('button', { name: 'Confirmar código' })).toBeInTheDocument()
    expect(screen.queryByRole('button', { name: 'Gerar código de segurança' })).not.toBeInTheDocument()
    expect(factors[0].status).toBe('verified')
  })
})
