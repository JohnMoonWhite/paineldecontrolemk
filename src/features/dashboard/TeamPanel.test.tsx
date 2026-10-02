import { fireEvent, render, screen } from '@testing-library/react'
import { describe, expect, it, vi } from 'vitest'
import { TeamPanel } from './TeamPanel'

const team = [
  { user_id: 'u1', name: 'Matheus', role: 'owner', is_me: true },
  { user_id: 'u2', name: 'Clebson', role: 'editor', is_me: false },
]

describe('TeamPanel', () => {
  it('lets an owner change the access level of other members', () => {
    const onRoleChange = vi.fn().mockResolvedValue(undefined)
    render(<TeamPanel team={team} onRoleChange={onRoleChange} />)

    fireEvent.change(screen.getByLabelText('Acesso de Clebson'), { target: { value: 'viewer' } })

    expect(onRoleChange).toHaveBeenCalledWith('u2', 'viewer')
    expect(screen.getByLabelText('Acesso de Matheus (você)')).toBeDisabled()
  })

  it('shows the levels without controls to members who are not owners', () => {
    render(<TeamPanel team={[{ ...team[0], role: 'editor' }, team[1]]} onRoleChange={vi.fn()} />)

    expect(screen.queryByRole('combobox')).not.toBeInTheDocument()
    expect(screen.getAllByText('Pode lançar')).toHaveLength(2)
  })
})
