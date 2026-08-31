import type { SupabaseClient } from '@supabase/supabase-js'
import { supabase } from '@/lib/supabase'
import type { Database, Json } from '@/types/supabase'
import type { Reporte, ReporteInsert } from '@/types/domain'

/**
 * Cliente a usar para la query. Por defecto el compartido (browser, con la
 * sesión del usuario). Los crons pasan el cliente service-role, porque corren
 * sin sesión y RLS los rechazaría.
 */
type Client = SupabaseClient<Database>

// ─────────────────────────────────────────────────────────────────────────────
// Service functions
// ─────────────────────────────────────────────────────────────────────────────

/**
 * Fetch all generated reports, newest first.
 * The metricas JSONB field is cast to ReporteMetricas at the domain layer.
 */
export async function fetchReportes(): Promise<Reporte[]> {
  const { data, error } = await supabase
    .from('reportes_generados')
    .select('*')
    .order('creado_at', { ascending: false })

  if (error) throw new Error(`[reportes.service] fetchReportes: ${error.message}`)
  return (data as Reporte[]) ?? []
}

/**
 * Persist a new report record.
 * Accepts the domain-typed ReporteInsert so call sites work with ReporteMetricas
 * directly. The Json cast is isolated here at the service boundary.
 */
export async function insertReporte(
  payload: ReporteInsert,
  client: Client = supabase
): Promise<void> {
  const dbPayload = {
    ...payload,
    metricas: (payload.metricas ?? null) as Json | null,
  }
  const { error } = await client.from('reportes_generados').insert([dbPayload])
  if (error) throw new Error(`[reportes.service] insertReporte: ${error.message}`)
}

/**
 * Hard-delete a report by ID.
 * Reports are audit documents; deletion should be confirmed at the UI layer.
 */
export async function deleteReporte(id: string): Promise<void> {
  const { error } = await supabase.from('reportes_generados').delete().eq('id', id)
  if (error) throw new Error(`[reportes.service] deleteReporte: ${error.message}`)
}
