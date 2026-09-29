import { render, screen } from '@testing-library/react'
import App from './App'

describe('App', () => {
  it('shows a sign-in action before exposing executive metrics', () => {
    render(<App />)

    expect(screen.getByRole('button', { name: 'Entrar' })).toBeInTheDocument()
    expect(screen.queryByText('Assinaturas válidas')).not.toBeInTheDocument()
  })
})
