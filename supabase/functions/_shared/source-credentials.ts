export type ReadEnvironment = (name: string) => string | undefined

export type SourceCredentials = {
  url: string
  key: string
}

const readDenoEnvironment: ReadEnvironment = (name) => Deno.env.get(name)

export function resolveOrderSyncCredentials(
  readEnvironment: ReadEnvironment = readDenoEnvironment,
): SourceCredentials {
  const url = readRequired(readEnvironment, 'ORDERSYNC_SUPABASE_URL')
  const key = readRequired(readEnvironment, 'ORDERSYNC_READONLY_KEY')

  let parsedUrl: URL
  try {
    parsedUrl = new URL(url)
  } catch {
    throw new Error('ORDERSYNC_SUPABASE_URL must be a valid HTTPS URL')
  }

  if (parsedUrl.protocol !== 'https:' || !parsedUrl.hostname.endsWith('.supabase.co')) {
    throw new Error('ORDERSYNC_SUPABASE_URL must be an HTTPS Supabase URL')
  }

  return { url: parsedUrl.origin, key }
}

function readRequired(readEnvironment: ReadEnvironment, name: string): string {
  const value = readEnvironment(name)?.trim()
  if (!value) {
    throw new Error(name + ' is required')
  }

  return value
}
