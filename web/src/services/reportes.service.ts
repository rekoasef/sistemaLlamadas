import { supabase } from '@/lib/supabase'
import type { TablesInsert } from '@/types/supabase'
import type { Reporte } from '@/types/domain'

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
 * Accepts the full insert shape from the generated Supabase types
 * to ensure all required fields are provided at the call site.
 */
export async function insertReporte(
  payload: TablesInsert<'reportes_generados'>
): Promise<void> {
  const { error } = await supabase.from('reportes_generados').insert([payload])
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
