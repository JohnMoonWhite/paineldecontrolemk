import { fireEvent, render, screen } from '@testing-library/react'
import { describe, expect, it, vi } from 'vitest'
import { SetPasswordPage } from './SetPasswordPage'

describe('SetPasswordPage', () => {
  it('does not submit a password when confirmation differs', () => {
    const onSetPassword = vi.fn()
    render(<SetPasswordPage error={null} onSetPassword={onSetPassword} pending={false} />)

    fireEvent.change(screen.getByLabelText('Nova senha'), { target: { value: 'uma-senha-longa' } })
    fireEvent.change(screen.getByLabelText('Confirmar nova senha'), { target: { value: 'outra-senha-longa' } })
    fireEvent.click(screen.getByRole('button', { name: 'Salvar nova senha' }))

    expect(onSetPassword).not.toHaveBeenCalled()
    expect(screen.getByRole('alert')).toHaveTextContent('As senhas não coincidem.')
  })
})
