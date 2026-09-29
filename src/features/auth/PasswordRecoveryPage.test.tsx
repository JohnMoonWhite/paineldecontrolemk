import { fireEvent, render, screen } from '@testing-library/react'
import { describe, expect, it, vi } from 'vitest'
import { PasswordRecoveryPage } from './PasswordRecoveryPage'

describe('PasswordRecoveryPage', () => {
  it('requests a recovery link for the informed email only after submission', () => {
    const onRequest = vi.fn()
    render(<PasswordRecoveryPage error={null} onBack={vi.fn()} onRequest={onRequest} pending={false} sent={false} />)

    fireEvent.change(screen.getByLabelText('E-mail'), { target: { value: 'matheus_wilian@hotmail.com' } })
    fireEvent.click(screen.getByRole('button', { name: 'Enviar link seguro' }))

    expect(onRequest).toHaveBeenCalledWith('matheus_wilian@hotmail.com')
  })
})
