const safeToken = /^[A-Za-z][A-Za-z0-9_]{1,40}$/
const missingField = /^([a-z_]+\.[a-z_]+) is missing$/

/**
 * Turns a source read error into a message that keeps only a safe identifier
 * (SQL state, driver code, error class or source field), never free-form text.
 */
export function classifySourceReadError(error: unknown): Error {
  const code = typeof error === 'object' && error !== null && 'code' in error
    ? String(error.code)
    : ''

  if (code === '28P01' || code === '28000') {
    return new Error('ORDERSYNC_SOURCE_AUTH_FAILED')
  }

  if (code === '42501') {
    return new Error('ORDERSYNC_SOURCE_PERMISSION_FAILED')
  }

  if (/^[0-9A-Z]{5}$/.test(code) || safeToken.test(code)) {
    return new Error(`ORDERSYNC_SOURCE_READ_FAILED:${code}`)
  }

  if (error instanceof Error) {
    const field = error.message.match(missingField)?.[1]
    if (field) {
      return new Error(`ORDERSYNC_SOURCE_READ_FAILED:missing:${field}`)
    }

    if (safeToken.test(error.name)) {
      return new Error(`ORDERSYNC_SOURCE_READ_FAILED:${error.name}`)
    }
  }

  return new Error('ORDERSYNC_SOURCE_READ_FAILED')
}
