import type { Tables } from './supabase'

// ─────────────────────────────────────────────────────────────────────────────
// Database row extensions
// ─────────────────────────────────────────────────────────────────────────────

/**
 * A llamada row enriched with the joined concesionario name.
 * We avoid storing the full concesionario object to keep memory lean;
 * only the display name is needed in all current views.
 */
export type LlamadaConConcesionario = Tables<'llamadas'> & {
  concesionarios: {
    nombre: string
    provincia: string | null
    ciudad: string | null
    latitud: number | null
    longitud: number | null
  } | null
}

/** Raw alias row re-exported for convenience. */
export type DispositivoAlias = Tables<'dispositivo_alias'>

// ─────────────────────────────────────────────────────────────────────────────
// In-memory maps
// ─────────────────────────────────────────────────────────────────────────────

/**
 * Client-side dispositivo_id → human alias lookup.
 * Built once from dispositivo_alias and used across all components,
 * avoiding JOIN overhead on realtime-sensitive llamadas queries.
 */
export type AliasMap = Record<string, string>

// ─────────────────────────────────────────────────────────────────────────────
// KPI / Analytics
// ─────────────────────────────────────────────────────────────────────────────

/**
 * Computed KPI summary for a set of calls.
 *
 * Efficiency uses the Gestión Proactiva model:
 *   Puntos Positivos    = Entrantes Atendidas + Todas las Salientes
 *   Total Interacciones = Total Entrantes     + Todas las Salientes
 *   Eficiencia          = (Puntos Positivos / Total Interacciones) × 100
 */
export interface KPIStats {
  total: number
  entrantes: number
  salientes: number
  /** Incoming calls answered (entrantes atendidas). */
  atendidas: number
  /** Percentage: (entrantesAtendidas + salientes) / (entrantes + salientes) × 100 */
  eficiencia: number
  /** Non-attended incoming calls within the 07–19hs commercial window. */
  perdidasComerciales: number

  entrantesPerdidas: number
}

/** Per-terminal performance metrics used in the BI analytics view. */
export interface TerminalStats {
  id: string
  /** Human-readable alias resolved from AliasMap */
  alias: string
  total: number
  atendidas: number
}

/** Missed-call count grouped by dealership for the ranking widget. */
export interface FugaStats {
  nombre: string
  cantidad: number
}

// ─────────────────────────────────────────────────────────────────────────────
// Reports
// ─────────────────────────────────────────────────────────────────────────────

/**
 * Missed-call breakdown for a single commercial time slot.
 * Used to give operational teams a granular view of peak-loss periods.
 */
export interface FranjaPerdidas {
  /** Display label, e.g. "07–10 hs" */
  label: string
  /** Hour start (inclusive) */
  inicio: number
  /** Hour end (exclusive) */
  fin: number
  perdidas: number
  total: number
  /** Percentage of slot's calls that were missed */
  porcentaje: number
}

/** Typed JSONB metrics stored inside reportes_generados.metricas. */
export interface ReporteMetricas {
  total: number
  entrantes: number
  salientes: number
  atendidas: number
  eficiencia: number
  /** Granular missed-call breakdown by commercial time slot (optional, added in v2.1) */
  franjas?: FranjaPerdidas[]
  /** Top 10 dealerships by incoming call volume (optional, added in v2.2) */
  topConcesionarios?: { nombre: string; total: number }[]
}

/** Discriminated union for report origin. */
export type TipoReporte = 'MANUAL' | 'AUTOMATICO'

/**
 * Strongly-typed report row.
 * Overrides the generic Json metricas field with the concrete ReporteMetricas shape
 * and narrows tipo to the TipoReporte union.
 */
export type Reporte = Omit<Tables<'reportes_generados'>, 'metricas' | 'tipo'> & {
  metricas: ReporteMetricas | null
  tipo: TipoReporte | null
}

// ─────────────────────────────────────────────────────────────────────────────
// Filters
// ─────────────────────────────────────────────────────────────────────────────

/** Quick-select period shortcuts for date filtering. */
export type PeriodoRapido = 'dia' | 'semana' | 'mes' | 'total'

/**
 * Serialisable filter state passed to the llamadas service.
 * Separating filter shape from component state allows the service
 * to build queries without importing React hooks.
 */
export interface FiltroLlamadas {
  usarCalendario: boolean
  periodo: PeriodoRapido
  fechaEspecifica: string
  mesSeleccionado: number
  anioSeleccionado: number
}
