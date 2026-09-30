import { describe, expect, it } from 'vitest'
import { classifySourceReadError } from './source-read-error'

describe('classifySourceReadError', () => {
  it('maps authentication and permission SQL states', () => {
    expect(classifySourceReadError({ code: '28P01' }).message).toBe('ORDERSYNC_SOURCE_AUTH_FAILED')
    expect(classifySourceReadError({ code: '42501' }).message).toBe('ORDERSYNC_SOURCE_PERMISSION_FAILED')
  })

  it('keeps other SQL states', () => {
    expect(classifySourceReadError({ code: 'XX000' }).message).toBe('ORDERSYNC_SOURCE_READ_FAILED:XX000')
  })

  it('keeps driver and network codes such as CONNECT_TIMEOUT or ENOTFOUND', () => {
    expect(classifySourceReadError({ code: 'CONNECT_TIMEOUT' }).message).toBe(
      'ORDERSYNC_SOURCE_READ_FAILED:CONNECT_TIMEOUT',
    )
    expect(classifySourceReadError({ code: 'ENOTFOUND' }).message).toBe('ORDERSYNC_SOURCE_READ_FAILED:ENOTFOUND')
  })

  it('falls back to the error class name when there is no code', () => {
    class ConnectionRefused extends Error {
      name = 'ConnectionRefused'
    }

    expect(classifySourceReadError(new ConnectionRefused('secret host detail')).message).toBe(
      'ORDERSYNC_SOURCE_READ_FAILED:ConnectionRefused',
    )
  })

  it('names the source field when a row is missing a required value', () => {
    expect(classifySourceReadError(new Error('organization_members.user_id is missing')).message).toBe(
      'ORDERSYNC_SOURCE_READ_FAILED:missing:organization_members.user_id',
    )
  })

  it('never copies free-form messages', () => {
    const message = classifySourceReadError(new Error('password=do-not-store')).message

    expect(message).toBe('ORDERSYNC_SOURCE_READ_FAILED:Error')
    expect(message).not.toContain('do-not-store')
  })
})
