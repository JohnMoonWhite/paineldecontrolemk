import { createClient, type SupabaseClient } from '@supabase/supabase-js'

let client: SupabaseClient | null | undefined

export function getSupabaseClient(): SupabaseClient | null {
  if (client !== undefined) return client

  const url = import.meta.env.VITE_SUPABASE_URL?.trim()
  const publishableKey = import.meta.env.VITE_SUPABASE_ANON_KEY?.trim()
  client = url && publishableKey ? createClient(url, publishableKey) : null
  return client
}
