import type { LlamadaConConcesionario, AliasMap } from '@/types/domain'

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
 * Counts ALL incoming calls (answered or not) to rank by traffic volume.
 */
export interface ConcesionarioRanking {
  nombre: string
  /** Total incoming calls from this dealership today */
  total: number
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
 * Compute efficiency (% answered) per 3-hour commercial slot.
 *
 * This is the wallboard-facing counterpart to `calcularFugasPorFranja` in kpi.ts.
 * The difference: this measures SUCCESS (atendidas/total), not loss, which is
 * the positive framing appropriate for a public TV display.
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
    const atendidas = enFranja.filter(
      (ll) => ll.estado?.toUpperCase() === 'ATENDIDA'
    ).length
    const total = enFranja.length
    const eficiencia = total > 0 ? Math.round((atendidas / total) * 100) : 0
    return { label, inicio, fin, atendidas, total, eficiencia }
  })
}

/**
 * Rank active terminals by total calls descending with per-terminal efficiency.
 *
 * All calls (commercial and off-hours) are counted here so the wallboard
 * reflects real station activity throughout the day, not just audited hours.
 * Terminals with zero calls are excluded from the grid.
 *
 * @param llamadas - All today's calls.
 * @param aliasMap - Device ID → human label lookup (built from dispositivo_alias).
 */
export function calcularRankingTerminales(
  llamadas: LlamadaConConcesionario[],
  aliasMap: AliasMap
): TerminalRanking[] {
  const map = new Map<string, { total: number; atendidas: number }>()

  for (const ll of llamadas) {
    const id = ll.dispositivo_id ?? 'S/D'
    if (!map.has(id)) map.set(id, { total: 0, atendidas: 0 })
    const t = map.get(id)!
    t.total++
    if (ll.estado?.toUpperCase() === 'ATENDIDA') t.atendidas++
  }

  return Array.from(map.entries())
    .filter(([, t]) => t.total > 0)
    .map(([id, { total, atendidas }]) => ({
      id,
      alias: aliasMap[id] ?? `ST-${id}`,
      total,
      atendidas,
      eficiencia: Math.round((atendidas / total) * 100),
    }))
    .sort((a, b) => b.total - a.total)
}

/**
 * Rank dealerships by total incoming call volume today.
 *
 * Unlike `calcularFugasPorConcesionario` (which ranks by MISSED calls),
 * this ranks by TOTAL entrantes — more appropriate for a traffic-volume
 * leaderboard on the wallboard.
 *
 * @param llamadas - All today's calls.
 * @param top      - Maximum entries to return (default: 10).
 */
export function calcularTopConcesionarios(
  llamadas: LlamadaConConcesionario[],
  top = 10
): ConcesionarioRanking[] {
  const map = new Map<string, number>()

  for (const ll of llamadas) {
    if (ll.tipo_llamada?.toUpperCase() !== 'ENTRANTE') continue
    const nombre = ll.concesionarios?.nombre ?? 'SIN VINCULAR'
    map.set(nombre, (map.get(nombre) ?? 0) + 1)
  }

  return Array.from(map.entries())
    .map(([nombre, total]) => ({ nombre, total }))
    .sort((a, b) => b.total - a.total)
    .slice(0, top)
}
