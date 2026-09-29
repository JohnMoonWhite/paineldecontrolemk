import { fireEvent, render, screen } from '@testing-library/react'
import { describe, expect, it, vi } from 'vitest'
import { LoginPage } from './LoginPage'

describe('LoginPage', () => {
  it('sends the supplied email and password only after the user asks to enter', () => {
    const onSignIn = vi.fn()
    render(<LoginPage error={null} onRecoverPassword={vi.fn()} onSignIn={onSignIn} pending={false} />)

    fireEvent.change(screen.getByLabelText('E-mail'), { target: { value: 'socio@empresa.com' } })
    fireEvent.change(screen.getByLabelText('Senha'), { target: { value: 'senha-segura' } })
    fireEvent.click(screen.getByRole('button', { name: 'Entrar' }))

    expect(onSignIn).toHaveBeenCalledWith('socio@empresa.com', 'senha-segura')
  })

  it('does not reveal authorization details in an access-denied message', () => {
    render(<LoginPage error="Acesso não liberado" onRecoverPassword={vi.fn()} onSignIn={vi.fn()} pending={false} />)

    expect(screen.getByText('Acesso não liberado')).toBeVisible()
    expect(screen.queryByText(/allow-list|admin|RLS/i)).not.toBeInTheDocument()
  })

  it('lets a person start a password recovery without attempting to sign in', () => {
    const onSignIn = vi.fn()
    const onRecoverPassword = vi.fn()
    render(<LoginPage error={null} onRecoverPassword={onRecoverPassword} onSignIn={onSignIn} pending={false} />)

    fireEvent.click(screen.getByRole('button', { name: 'Esqueci minha senha' }))

    expect(onSignIn).not.toHaveBeenCalled()
    expect(onRecoverPassword).toHaveBeenCalledOnce()
  })
})
