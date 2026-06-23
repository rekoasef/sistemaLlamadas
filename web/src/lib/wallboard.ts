import type { LlamadaConConcesionario, AliasMap } from '@/types/domain'
import { esLlamadaEntrante } from '@/lib/kpi'

// ─────────────────────────────────────────────────────────────────────────────
// Wallboard-specific domain types
// ─────────────────────────────────────────────────────────────────────────────

/**
 * Per-slot efficiency summary for the Franja Horaria module.
 * Measures the SUCCESS rate (% atendidas) — inverse of FranjaPerdidas.porcentaje.
 * Each slot represents a 3-hour block within the 07–19hs commercial window.
 */
export interface FranjaEficiencia {
  /** Display label, e.g. "07–10 hs" */
  label: string
  /** Hour start (inclusive) */
  inicio: number
  /** Hour end (exclusive) */
  fin: number
  /** Count of answered calls within the slot */
  atendidas: number
  /** Total calls within the slot */
  total: number
  /** Percentage of answered calls (0–100) */
  eficiencia: number
}

/**
 * Per-terminal performance row for the wallboard grid.
 * Includes efficiency to surface underperforming stations at a glance.
 */
export interface TerminalRanking {
  id: string
  /** Human alias resolved from AliasMap (e.g. "ST-1", "Recepción") */
  alias: string
  total: number
  atendidas: number
  /** Percentage of answered calls (0–100) */
  eficiencia: number
}

/**
 * Per-dealership call volume for the Top-N ranking widget.
 * Counts ALL calls (incoming + outgoing) to rank by traffic volume.
 */
export interface ConcesionarioRanking {
  nombre: string
  /** Total calls (entrantes + salientes) from/to this dealership */
  total: number
  /** Calls with estado === 'ATENDIDA' */
  atendidas: number
  /** Calls with estado !== 'ATENDIDA' */
  perdidas: number
}

// ─────────────────────────────────────────────────────────────────────────────
// Constants
// ─────────────────────────────────────────────────────────────────────────────

/** The four 3-hour blocks that comprise the commercial window (07–19hs). */
const FRANJAS_COMERCIALES: Pick<FranjaEficiencia, 'label' | 'inicio' | 'fin'>[] = [
  { label: '07–10 hs', inicio: 7,  fin: 10 },
  { label: '10–13 hs', inicio: 10, fin: 13 },
  { label: '13–16 hs', inicio: 13, fin: 16 },
  { label: '16–19 hs', inicio: 16, fin: 19 },
]

// ─────────────────────────────────────────────────────────────────────────────
// Computation helpers
// ─────────────────────────────────────────────────────────────────────────────

/**
 * Compute efficiency per 3-hour commercial slot — Gestión Proactiva model.
 *
 * Per-slot formula (mirrors calcularKPIs):
 *   Puntos Positivos    = Entrantes Atendidas en franja + Salientes en franja
 *   Total Interacciones = Total Entrantes en franja     + Salientes en franja
 *   Eficiencia          = (Puntos Positivos / Total Interacciones) × 100
 *
 * The `atendidas` field holds Puntos Positivos for display purposes
 * (shown as "atendidas/total" in the wallboard row).
 *
 * @param llamadas - All today's calls (already filtered to the current day).
 * @returns Four FranjaEficiencia entries in chronological order.
 */
export function calcularEficienciaFranjas(
  llamadas: LlamadaConConcesionario[]
): FranjaEficiencia[] {
  return FRANJAS_COMERCIALES.map(({ label, inicio, fin }) => {
    const enFranja = llamadas.filter((ll) => {
      if (!ll.fecha_llamada) return false
      const h = new Date(ll.fecha_llamada).getHours()
      return h >= inicio && h < fin
    })
    const entrantes = enFranja.filter((ll) => esLlamadaEntrante(ll.tipo_llamada))
    const salientes = enFranja.filter((ll) => !esLlamadaEntrante(ll.tipo_llamada))
    const entrantesAtendidas = entrantes.filter(
      (ll) => ll.estado?.toUpperCase() === 'ATENDIDA'
    ).length
    const puntosPositivos = entrantesAtendidas + salientes.length
    const total = entrantes.length + salientes.length
    const eficiencia = total > 0 ? Math.round((puntosPositivos / total) * 100) : 0
    return { label, inicio, fin, atendidas: puntosPositivos, total, eficiencia }
  })
}

/**
 * Rank active terminals by total interactions with per-terminal efficiency.
 *
 * Applies the Gestión Proactiva model per terminal:
 *   Puntos Positivos    = Entrantes Atendidas + Todas las Salientes del terminal
 *   Total Interacciones = Total Entrantes     + Todas las Salientes del terminal
 *   Eficiencia          = (Puntos Positivos / Total Interacciones) × 100
 *
 * The `atendidas` field holds Puntos Positivos so existing UI components
 * render the correct ratio without interface changes.
 *
 * @param llamadas - All today's calls.
 * @param aliasMap - Device ID → human label lookup (built from dispositivo_alias).
 */
export function calcularRankingTerminales(
  llamadas: LlamadaConConcesionario[],
  aliasMap: AliasMap
): TerminalRanking[] {
  const map = new Map<string, { entrantes: number; entrantesAtendidas: number; salientes: number }>()

  for (const ll of llamadas) {
    const id = ll.dispositivo_id ?? 'S/D'
    if (!map.has(id)) map.set(id, { entrantes: 0, entrantesAtendidas: 0, salientes: 0 })
    const t = map.get(id)!
    if (esLlamadaEntrante(ll.tipo_llamada)) {
      t.entrantes++
      if (ll.estado?.toUpperCase() === 'ATENDIDA') t.entrantesAtendidas++
    } else {
      t.salientes++
    }
  }

  return Array.from(map.entries())
    .filter(([, t]) => t.entrantes + t.salientes > 0)
    .map(([id, { entrantes, entrantesAtendidas, salientes }]) => {
      const total = entrantes + salientes
      const atendidas = entrantesAtendidas + salientes // puntos positivos
      return {
        id,
        alias: aliasMap[id] ?? `ST-${id}`,
        total,
        atendidas,
        eficiencia: Math.round((atendidas / total) * 100),
      }
    })
    .sort((a, b) => b.total - a.total)
}

/**
 * Rank dealerships by total call volume (entrantes + salientes).
 *
 * Unlike `calcularFugasPorConcesionario` (which ranks by MISSED calls),
 * this ranks by TOTAL interactions — more appropriate for a traffic-volume
 * leaderboard on the wallboard.
 *
 * @param llamadas - All today's calls.
 * @param top      - Maximum entries to return (default: 10).
 */
export function calcularTopConcesionarios(
  llamadas: LlamadaConConcesionario[],
  top = 10
): ConcesionarioRanking[] {
  const map = new Map<string, { atendidas: number; perdidas: number }>()

  for (const ll of llamadas) {
    const nombre = ll.concesionarios?.nombre ?? 'SIN VINCULAR'
    if (!map.has(nombre)) map.set(nombre, { atendidas: 0, perdidas: 0 })
    const entry = map.get(nombre)!
    if (ll.estado?.toUpperCase() === 'ATENDIDA') {
      entry.atendidas++
    } else {
      entry.perdidas++
    }
  }

  return Array.from(map.entries())
    .map(([nombre, { atendidas, perdidas }]) => ({
      nombre,
      total: atendidas + perdidas,
      atendidas,
      perdidas,
    }))
    .sort((a, b) => b.total - a.total)
    .slice(0, top)
}
