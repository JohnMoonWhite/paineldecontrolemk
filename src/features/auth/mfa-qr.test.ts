import { describe, expect, it } from 'vitest'
import { mfaQrImageSource } from './mfa-qr'

describe('mfaQrImageSource', () => {
  it('preserves the image source returned by Supabase MFA enrollment', () => {
    const source = 'data:image/svg+xml;utf-8,%3Csvg%20xmlns%3D%22http%3A%2F%2Fwww.w3.org%2F2000%2Fsvg%22%2F%3E'

    expect(mfaQrImageSource(source)).toBe(source)
  })
})
