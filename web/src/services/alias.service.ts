import { supabase } from '@/lib/supabase'
import type { AliasMap, DispositivoAlias } from '@/types/domain'

// ─────────────────────────────────────────────────────────────────────────────
// Mappers
// ─────────────────────────────────────────────────────────────────────────────

/**
 * Build an O(1)-lookup AliasMap from raw DB rows.
 * Kept as a pure function so it can be unit-tested without a DB connection.
 */
export function buildAliasMap(aliases: DispositivoAlias[]): AliasMap {
  return aliases.reduce<AliasMap>((acc, a) => {
    acc[a.dispositivo_id] = a.alias
    return acc
  }, {})
}

// ─────────────────────────────────────────────────────────────────────────────
// Service functions
// ─────────────────────────────────────────────────────────────────────────────

/**
 * Fetch all device aliases and return as a keyed in-memory map.
 * Called once on component mount; the result is stable for the session.
 * Preferring a client-side map over a DB JOIN keeps realtime queries clean.
 */
export async function fetchAliasMap(): Promise<AliasMap> {
  const { data, error } = await supabase.from('dispositivo_alias').select('*')
  if (error) throw new Error(`[alias.service] fetchAliasMap: ${error.message}`)
  return buildAliasMap((data as DispositivoAlias[]) ?? [])
}

/**
 * Upsert a device alias.
 * Uses onConflict on dispositivo_id (unique index) to behave as update-or-insert.
 */
export async function upsertAlias(dispositivoId: string, alias: string): Promise<void> {
  const { error } = await supabase
    .from('dispositivo_alias')
    .upsert({ dispositivo_id: dispositivoId, alias }, { onConflict: 'dispositivo_id' })
  if (error) throw new Error(`[alias.service] upsertAlias: ${error.message}`)
}
