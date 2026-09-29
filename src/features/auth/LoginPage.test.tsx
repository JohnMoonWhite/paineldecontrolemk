import { fireEvent, render, screen } from '@testing-library/react'
import { describe, expect, it, vi } from 'vitest'
import { LoginPage } from './LoginPage'

describe('LoginPage', () => {
  it('sends the supplied email and password only after the user asks to enter', () => {
    const onSignIn = vi.fn()
    render(<LoginPage onSignIn={onSignIn} pending={false} error={null} />)

    fireEvent.change(screen.getByLabelText('E-mail'), { target: { value: 'socio@empresa.com' } })
    fireEvent.change(screen.getByLabelText('Senha'), { target: { value: 'senha-segura' } })
    fireEvent.click(screen.getByRole('button', { name: 'Entrar' }))

    expect(onSignIn).toHaveBeenCalledWith('socio@empresa.com', 'senha-segura')
  })

  it('does not reveal authorization details in an access-denied message', () => {
    render(<LoginPage onSignIn={vi.fn()} pending={false} error="Acesso não liberado" />)

    expect(screen.getByText('Acesso não liberado')).toBeVisible()
    expect(screen.queryByText(/allow-list|admin|RLS/i)).not.toBeInTheDocument()
  })
})
