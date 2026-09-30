import { render, screen } from '@testing-library/react'
import { vi } from 'vitest'
import App from './App'
import { getSupabaseClient } from './lib/supabase'

vi.mock('./lib/supabase', () => ({ getSupabaseClient: vi.fn() }))
vi.mock('./features/dashboard/ExecutiveDashboard', () => ({ ExecutiveDashboard: () => <h1>Resumo executivo</h1> }))

afterEach(() => vi.resetAllMocks())

describe('App', () => {
  it('shows a sign-in action before exposing executive metrics', () => {
    render(<App />)

    expect(screen.getByRole('button', { name: 'Entrar' })).toBeInTheDocument()
    expect(screen.queryByText('Assinaturas válidas')).not.toBeInTheDocument()
  })

  it('opens the dashboard right after a session exists, without a second factor', async () => {
    vi.mocked(getSupabaseClient).mockReturnValue({ auth: {
      getSession: async () => ({ data: { session: { user: { id: 'user' } } }, error: null }),
      onAuthStateChange: (callback: (event: string) => void) => {
        setTimeout(() => callback('INITIAL_SESSION'), 0)
        return { data: { subscription: { unsubscribe() {} } } }
      },
    } } as unknown as ReturnType<typeof getSupabaseClient>)

    render(<App />)

    expect(await screen.findByRole('heading', { name: 'Resumo executivo' })).toBeInTheDocument()
    expect(screen.queryByRole('button', { name: 'Confirmar código' })).not.toBeInTheDocument()
  })
})
