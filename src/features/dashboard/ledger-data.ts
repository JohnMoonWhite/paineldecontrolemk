import type { SupabaseClient } from '@supabase/supabase-js'
import type { NewLedgerEntry } from './CompanyCashPanel'

export async function addLedgerEntry(client: SupabaseClient, entry: NewLedgerEntry): Promise<void> {
  const { error } = await client.from('monitoring_ledger_entries').insert(entry)
  if (error) throw new Error('Não foi possível salvar o lançamento. Tente novamente.')
}

/** Entries are kept for history; removing one only marks it as deleted. */
export async function removeLedgerEntry(client: SupabaseClient, entryId: string): Promise<void> {
  const now = new Date().toISOString()
  const { error } = await client.from('monitoring_ledger_entries').update({ deleted_at: now, updated_at: now }).eq('id', entryId)
  if (error) throw new Error('Não foi possível excluir o lançamento. Tente novamente.')
}
