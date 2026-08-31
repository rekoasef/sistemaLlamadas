import type { SupabaseClient } from '@supabase/supabase-js'
import { supabase } from '@/lib/supabase'
import type { Database } from '@/types/supabase'
import type { LlamadaConConcesionario, FiltroLlamadas } from '@/types/domain'

/** Ver la nota en reportes.service: los crons inyectan el cliente service-role. */
type Client = SupabaseClient<Database>

// ─────────────────────────────────────────────────────────────────────────────
// Internal helpers
// ─────────────────────────────────────────────────────────────────────────────

/**
 * Translate the active FiltroLlamadas state into an ISO date range.
 * Returns a partial object — callers apply only the bounds that are defined.
 */
function buildDateRange(
  filtro: FiltroLlamadas
): { gte?: string; lte?: string } {
  if (!filtro.usarCalendario) {
    const now = new Date()
    if (filtro.periodo === 'dia') {
      return { gte: new Date(now.setHours(0, 0, 0, 0)).toISOString() }
    }
    if (filtro.periodo === 'semana') {
      const d = new Date()
      d.setDate(d.getDate() - 7)
      return { gte: d.toISOString() }
    }
    if (filtro.periodo === 'mes') {
      const d = new Date()
      d.setMonth(d.getMonth() - 1)
      return { gte: d.toISOString() }
    }
    return {} // 'total' — no bounds
  }

  if (filtro.fechaEspecifica) {
    return {
      gte: `${filtro.fechaEspecifica}T00:00:00`,
      lte: `${filtro.fechaEspecifica}T23:59:59`,
    }
  }

  // Calendar mode: full month
  return {
    gte: new Date(filtro.anioSeleccionado, filtro.mesSeleccionado - 1, 1).toISOString(),
    lte: new Date(
      filtro.anioSeleccionado,
      filtro.mesSeleccionado,
      0,
      23,
      59,
      59
    ).toISOString(),
  }
}

// ─────────────────────────────────────────────────────────────────────────────
// Public service functions
// ─────────────────────────────────────────────────────────────────────────────

/** Row limit for the dashboard fetch — high enough to cover all current records,
 *  small enough to keep realtime payloads fast. Raise as the dataset grows. */
const DASHBOARD_ROW_LIMIT = 2000

/**
 * Fetch calls matching the current dashboard filter.
 * Bounded by DASHBOARD_ROW_LIMIT to keep the realtime refresh payload fast.
 * The concesionario join is a lightweight FK lookup, not a full scan.
 */
export async function fetchLlamadas(
  filtro: FiltroLlamadas
): Promise<LlamadaConConcesionario[]> {
  let query = supabase
    .from('llamadas')
    .select('*, concesionarios:concesionario_id (nombre, provincia, ciudad, latitud, longitud)')
    .order('fecha_llamada', { ascending: false })

  const range = buildDateRange(filtro)
  if (range.gte) query = query.gte('fecha_llamada', range.gte)
  if (range.lte) query = query.lte('fecha_llamada', range.lte)

  const { data, error } = await query.limit(DASHBOARD_ROW_LIMIT)
  if (error) throw new Error(`[llamadas.service] fetchLlamadas: ${error.message}`)
  return (data as LlamadaConConcesionario[]) ?? []
}

/**
 * Fetch a single call row by primary key, including the concesionario name.
 * Used by the realtime handler to hydrate incoming change events.
 */
export async function fetchLlamadaById(
  id: string
): Promise<LlamadaConConcesionario | null> {
  const { data, error } = await supabase
    .from('llamadas')
    .select('*, concesionarios:concesionario_id (nombre, provincia, ciudad, latitud, longitud)')
    .eq('id', id)
    .single()

  if (error) return null
  return data as LlamadaConConcesionario
}

/**
 * Fetch all calls within a closed date range for report generation.
 * No row limit — reports need the full dataset for accurate KPI aggregation.
 */
export async function fetchLlamadasByRange(
  fechaInicio: string,
  fechaFin: string,
  client: Client = supabase
): Promise<LlamadaConConcesionario[]> {
  const { data, error } = await client
    .from('llamadas')
    .select('*, concesionarios:concesionario_id (nombre, provincia, ciudad, latitud, longitud)')
    .gte('fecha_llamada', `${fechaInicio}T00:00:00`)
    .lte('fecha_llamada', `${fechaFin}T23:59:59`)

  if (error) throw new Error(`[llamadas.service] fetchLlamadasByRange: ${error.message}`)
  return (data as LlamadaConConcesionario[]) ?? []
}

/**
 * Fetch all calls recorded today (00:00–23:59 local time).
 *
 * Designed for the wallboard's 15-second polling loop: no row cap is applied
 * because the full day dataset is needed for accurate KPI, franja, and ranking
 * aggregations. The query is bounded to the current day to keep it fast.
 */
export async function fetchLlamadasHoy(): Promise<LlamadaConConcesionario[]> {
  const now = new Date()
  const gte = new Date(now.getFullYear(), now.getMonth(), now.getDate(), 0, 0, 0).toISOString()
  const lte = new Date(now.getFullYear(), now.getMonth(), now.getDate(), 23, 59, 59).toISOString()

  const { data, error } = await supabase
    .from('llamadas')
    .select('*, concesionarios:concesionario_id (nombre, provincia, ciudad, latitud, longitud)')
    .gte('fecha_llamada', gte)
    .lte('fecha_llamada', lte)
    .order('fecha_llamada', { ascending: false })

  if (error) throw new Error(`[llamadas.service] fetchLlamadasHoy: ${error.message}`)
  return (data as LlamadaConConcesionario[]) ?? []
}

/**
 * Fetch the entire call history for analytics aggregation.
 * This is acceptable for the BI page since it's not on the realtime path.
 */
export async function fetchTodasLasLlamadas(): Promise<LlamadaConConcesionario[]> {
  const { data, error } = await supabase
    .from('llamadas')
    .select('*, concesionarios:concesionario_id (nombre, provincia, ciudad, latitud, longitud)')

  if (error) throw new Error(`[llamadas.service] fetchTodasLasLlamadas: ${error.message}`)
  return (data as LlamadaConConcesionario[]) ?? []
}

/** Range options available on the wallboard selector. */
export type RangoWallboard = 'HOY' | '7D' | '30D' | 'HISTORICO'

/**
 * Fetch calls for the wallboard based on the selected range.
 * No row cap is applied so all aggregations (KPIs, franjas, rankings)
 * are always computed against the full dataset for the period.
 */
export async function fetchLlamadasWallboard(
  rango: RangoWallboard
): Promise<LlamadaConConcesionario[]> {
  if (rango === 'HOY') return fetchLlamadasHoy()
  if (rango === 'HISTORICO') return fetchTodasLasLlamadas()

  const now = new Date()
  const gte = new Date(now)
  if (rango === '7D') {
    gte.setDate(gte.getDate() - 7)
  } else {
    gte.setMonth(gte.getMonth() - 1)
  }
  gte.setHours(0, 0, 0, 0)

  const { data, error } = await supabase
    .from('llamadas')
    .select('*, concesionarios:concesionario_id (nombre, provincia, ciudad, latitud, longitud)')
    .gte('fecha_llamada', gte.toISOString())
    .order('fecha_llamada', { ascending: false })

  if (error) throw new Error(`[llamadas.service] fetchLlamadasWallboard: ${error.message}`)
  return (data as LlamadaConConcesionario[]) ?? []
}

// ─────────────────────────────────────────────────────────────────────────────
// Concesionarios con coordenadas
// ─────────────────────────────────────────────────────────────────────────────

export interface ConcesionarioConCoords {
  id: string
  nombre: string
  ciudad: string | null
  provincia: string | null
  latitud: number
  longitud: number
}

/** Returns all concesionarios that have lat/lng set. */
export async function fetchConcesionariosConCoords(): Promise<ConcesionarioConCoords[]> {
  const { data, error } = await supabase
    .from('concesionarios')
    .select('id, nombre, ciudad, provincia, latitud, longitud')
    .not('latitud', 'is', null)
    .not('longitud', 'is', null)

  if (error) throw new Error(`[llamadas.service] fetchConcesionariosConCoords: ${error.message}`)
  return (data as ConcesionarioConCoords[]) ?? []
}
