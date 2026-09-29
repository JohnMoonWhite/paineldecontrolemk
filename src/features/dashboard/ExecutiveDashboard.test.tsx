import { render, screen } from '@testing-library/react'
import { describe, expect, it } from 'vitest'
import { SubscriptionHealth } from './SubscriptionHealth'

describe('SubscriptionHealth', () => {
  it('shows a useful zero-data state without suggesting source data is missing from the browser', () => {
    render(<SubscriptionHealth health={{ valid: 0, expiringSoon: 0, expiredOrInconsistent: 0, withoutExpiry: 0, individuals: 0, organizations: 0 }} />)

    expect(screen.getByText('Ainda não há uma fotografia para exibir.')).toBeVisible()
    expect(screen.queryByText(/email/i)).not.toBeInTheDocument()
  })
})
