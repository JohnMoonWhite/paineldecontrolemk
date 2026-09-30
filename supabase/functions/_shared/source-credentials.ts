export type ReadEnvironment = (name: string) => string | undefined

export type SourceCredentials = {
  databaseUrl: string
}

export type CredentialFailureReason =
  | 'missing'
  | 'invalid_url'
  | 'not_transaction_pooler'
  | 'incomplete'

/** Carries a secret-free reason so operators can tell which rule the URL failed. */
export class OrderSyncCredentialError extends Error {
  constructor(
    readonly reason: CredentialFailureReason,
    message: string,
  ) {
    super(message)
    this.name = 'OrderSyncCredentialError'
  }
}

const readDenoEnvironment: ReadEnvironment = (name) => Deno.env.get(name)

export function resolveOrderSyncCredentials(
  readEnvironment: ReadEnvironment = readDenoEnvironment,
): SourceCredentials {
  const databaseUrl = readRequired(readEnvironment, 'ORDERSYNC_DATABASE_URL')

  let parsedUrl: URL
  try {
    parsedUrl = new URL(databaseUrl)
  } catch {
    throw new OrderSyncCredentialError('invalid_url', 'ORDERSYNC_DATABASE_URL must be a valid Postgres URL')
  }

  if (parsedUrl.protocol !== 'postgresql:' && parsedUrl.protocol !== 'postgres:') {
    throw new OrderSyncCredentialError('invalid_url', 'ORDERSYNC_DATABASE_URL must be a valid Postgres URL')
  }

  if (!parsedUrl.hostname.endsWith('.pooler.supabase.com') || parsedUrl.port !== '6543') {
    throw new OrderSyncCredentialError(
      'not_transaction_pooler',
      'ORDERSYNC_DATABASE_URL must use the Supabase transaction-pooler',
    )
  }

  if (!parsedUrl.username || !parsedUrl.password || parsedUrl.pathname !== '/postgres') {
    throw new OrderSyncCredentialError('incomplete', 'ORDERSYNC_DATABASE_URL is incomplete')
  }

  return { databaseUrl }
}

function readRequired(readEnvironment: ReadEnvironment, name: string): string {
  const value = readEnvironment(name)?.trim()
  if (!value) {
    throw new OrderSyncCredentialError('missing', name + ' is required')
  }

  return value
}
