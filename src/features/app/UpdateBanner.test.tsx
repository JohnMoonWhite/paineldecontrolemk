import { fireEvent, render, screen } from '@testing-library/react'
import { describe, expect, it, vi } from 'vitest'
import { UpdateBanner } from './UpdateBanner'

describe('UpdateBanner', () => {
  it('stays hidden while there is no new version', () => {
    render(<UpdateBanner visible={false} onUpdate={vi.fn()} onDismiss={vi.fn()} />)

    expect(screen.queryByRole('status')).not.toBeInTheDocument()
  })

  it('offers to switch to the new version and lets the user postpone it', () => {
    const onUpdate = vi.fn()
    const onDismiss = vi.fn()
    render(<UpdateBanner visible onUpdate={onUpdate} onDismiss={onDismiss} />)

    expect(screen.getByRole('status')).toHaveTextContent('Nova versão do painel disponível')
    fireEvent.click(screen.getByRole('button', { name: 'Atualizar agora' }))
    fireEvent.click(screen.getByRole('button', { name: 'Depois' }))

    expect(onUpdate).toHaveBeenCalledOnce()
    expect(onDismiss).toHaveBeenCalledOnce()
  })
})
