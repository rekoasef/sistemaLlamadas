import type {
  LlamadaConConcesionario,
  KPIStats,
  TerminalStats,
  FugaStats,
  FranjaPerdidas,
  AliasMap,
} from '@/types/domain'

// ─────────────────────────────────────────────────────────────────────────────
// Constants
// ─────────────────────────────────────────────────────────────────────────────

/**
 * Commercial hours window per Crucianelli's operational policy.
 * Only calls within this range are included in the efficiency audit.
 */
const HORA_INICIO_COMERCIAL = 7
const HORA_FIN_COMERCIAL = 19

/** Efficiency threshold below which an alert is triggered in reports. */
export const UMBRAL_EFICIENCIA = 80

// ─────────────────────────────────────────────────────────────────────────────
// Helpers
// ─────────────────────────────────────────────────────────────────────────────

/**
 * Returns true if the ISO timestamp falls within the 07:00–19:00 commercial window.
 * Used as the primary audit filter across Dashboard, Analytics, and Reports.
 */
export function isHorarioComercial(fecha: string): boolean {
  const hora = new Date(fecha).getHours()
  return hora >= HORA_INICIO_COMERCIAL && hora < HORA_FIN_COMERCIAL
}

/**
 * Format duration in seconds to MM:SS display string.
 * Returns '00:00' for null/zero to avoid empty cells in the activity table.
 */
export function formatDuracion(segundos: number | null): string {
  const s = segundos ?? 0
  if (s === 0) return '00:00'
  const mins = Math.floor(s / 60)
  const secs = s % 60
  return `${String(mins).padStart(2, '0')}:${String(secs).padStart(2, '0')}`
}

// ─────────────────────────────────────────────────────────────────────────────
// KPI Computation
// ─────────────────────────────────────────────────────────────────────────────

/**
 * Compute KPI summary from a set of calls.
 *
 * Efficiency logic — Gestión Proactiva del Call Center:
 * - Entrante atendida   → sube la eficiencia (gestión exitosa).
 * - Entrante no atendida → baja la eficiencia (fuga de cliente).
 * - Saliente (cualquier resultado) → sube la eficiencia (se premia la proactividad
 *   del operador al intentar recuperar el llamado, independientemente del resultado).
 *
 * Fórmula:
 *   Puntos Positivos    = Entrantes Atendidas + Todas las Salientes
 *   Total Interacciones = Total Entrantes     + Todas las Salientes
 *   Eficiencia          = (Puntos Positivos / Total Interacciones) × 100
 */
export function calcularKPIs(llamadas: LlamadaConConcesionario[]): KPIStats {
  let entrantes = 0
  let salientes = 0
  let entrantesAtendidas = 0
  let entrantesPerdidas = 0
  let perdidasComerciales = 0

  for (const ll of llamadas) {
    const tipo = ll.tipo_llamada?.toUpperCase()
    const atendida = ll.estado?.toUpperCase() === 'ATENDIDA'
    const esComercial = ll.fecha_llamada ? isHorarioComercial(ll.fecha_llamada) : false

    if (tipo === 'ENTRANTE') {
      entrantes++
      if (atendida) entrantesAtendidas++
      else {
        entrantesPerdidas++
        if (esComercial) perdidasComerciales++
      }
    } else {
      salientes++
    }
  }

  const puntosPositivos = entrantesAtendidas + salientes
  const totalInteracciones = entrantes + salientes
  const eficiencia =
    totalInteracciones > 0 ? Math.round((puntosPositivos / totalInteracciones) * 100) : 0

  return {
    total: llamadas.length,
    entrantes,
    salientes,
    atendidas: entrantesAtendidas,
    eficiencia,
    //@ts-ignore
    entrantesPerdidas,
    perdidasComerciales,
  }
}

// ─────────────────────────────────────────────────────────────────────────────
// Analytics Aggregations
// ─────────────────────────────────────────────────────────────────────────────

/**
 * Aggregate per-terminal performance, resolving device IDs to human aliases.
 * Sorted by total call volume descending for the BI chart.
 */
export function calcularStatsPorTerminal(
  llamadas: LlamadaConConcesionario[],
  aliasMap: AliasMap
): TerminalStats[] {
  const map = new Map<string, TerminalStats>()

  for (const ll of llamadas) {
    const id = ll.dispositivo_id ?? 'S/D'
    if (!map.has(id)) {
      map.set(id, { id, alias: aliasMap[id] ?? `Puesto ${id}`, total: 0, atendidas: 0 })
    }

    const stat = map.get(id)!
    const esComercial = ll.fecha_llamada ? isHorarioComercial(ll.fecha_llamada) : false
    const atendida = ll.estado?.toUpperCase() === 'ATENDIDA'

    if (esComercial) {
      stat.total++
      if (atendida) stat.atendidas++
    } else if (atendida) {
      stat.total++
      stat.atendidas++
    }
  }

  return Array.from(map.values())
    .filter((p) => p.total > 0)
    .sort((a, b) => b.total - a.total)
}

/**
 * Build a 24-slot hourly distribution array.
 * Index = hour (0–23), value = call count.
 * Used to render the traffic density chart in the BI view.
 */
export function calcularStatsHorarias(llamadas: LlamadaConConcesionario[]): number[] {
  const horas = new Array<number>(24).fill(0)
  for (const ll of llamadas) {
    if (ll.fecha_llamada) {
      horas[new Date(ll.fecha_llamada).getHours()]++
    }
  }
  return horas
}

/**
 * Rank dealerships by missed calls within commercial hours.
 * Returns top 6 — sufficient for the dashboard ranking widget.
 * 'SIN VINCULAR' catches calls not yet linked to a concesionario.
 */
export function calcularFugasPorConcesionario(
  llamadas: LlamadaConConcesionario[]
): FugaStats[] {
  const map = new Map<string, number>()

  for (const ll of llamadas) {
    const estado = ll.estado?.toUpperCase() ?? ''
    const esComercial = ll.fecha_llamada ? isHorarioComercial(ll.fecha_llamada) : false

    if (['PERDIDA', 'RECHAZADA'].includes(estado) && esComercial) {
      const nombre = ll.concesionarios?.nombre ?? 'SIN VINCULAR'
      map.set(nombre, (map.get(nombre) ?? 0) + 1)
    }
  }

  return Array.from(map.entries())
    .map(([nombre, cantidad]) => ({ nombre, cantidad }))
    .sort((a, b) => b.cantidad - a.cantidad)
    .slice(0, 6)
}

// ─────────────────────────────────────────────────────────────────────────────
// Time-slot Granularity
// ─────────────────────────────────────────────────────────────────────────────

/**
 * Commercial hour slots for granular missed-call analysis.
 * Each slot represents a 3-hour block within the 07–19hs audited window.
 */
const FRANJAS_COMERCIALES: Pick<FranjaPerdidas, 'label' | 'inicio' | 'fin'>[] = [
  { label: '07–10 hs', inicio: 7,  fin: 10 },
  { label: '10–13 hs', inicio: 10, fin: 13 },
  { label: '13–16 hs', inicio: 13, fin: 16 },
  { label: '16–19 hs', inicio: 16, fin: 19 },
]

/**
 * Break down missed calls by commercial time slot (07–10, 10–13, 13–16, 16–19).
 *
 * This gives operational teams insight into WHICH part of the day is most
 * problematic so they can adjust staffing accordingly.
 * Only calls within the commercial window are included (per audit policy).
 */
export function calcularFugasPorFranja(
  llamadas: LlamadaConConcesionario[]
): FranjaPerdidas[] {
  return FRANJAS_COMERCIALES.map(({ label, inicio, fin }) => {
    const enFranja = llamadas.filter((ll) => {
      if (!ll.fecha_llamada) return false
      const h = new Date(ll.fecha_llamada).getHours()
      return h >= inicio && h < fin
    })
    const perdidas = enFranja.filter(
      (ll) => ll.estado?.toUpperCase() !== 'ATENDIDA'
    ).length
    const total = enFranja.length
    const porcentaje = total > 0 ? Math.round((perdidas / total) * 100) : 0

    return { label, inicio, fin, perdidas, total, porcentaje }
  })
}

// ─────────────────────────────────────────────────────────────────────────────
// Report Text Generation
// ─────────────────────────────────────────────────────────────────────────────

/**
 * Generate a plain-text executive summary based on computed KPIs.
 * Applies Crucianelli's 60% efficiency threshold as the pass/fail rule.
 * Output is stored as-is in reportes_generados.resumen_escrito.
 */
export function generarResumenEjecutivo(
  kpis: KPIStats,
  fechaInicio: string,
  fechaFin: string,
  franjas?: FranjaPerdidas[]
): string {
  const alertaEficiencia =
    kpis.eficiencia < UMBRAL_EFICIENCIA
      ? 'ALERTA: SE DETECTA UN NIVEL DE PÉRDIDA DE LLAMADAS POR ENCIMA DEL UMBRAL PERMITIDO. SE RECOMIENDA REVISAR LA DISPONIBILIDAD DE LAS TERMINALES.'
      : 'ESTADO ÓPTIMO: EL EQUIPO MANTIENE UN NIVEL DE RESPUESTA SATISFACTORIO PARA LOS ESTÁNDARES DE LA RED.'

  const lines = [
    'INFORME DE AUDITORÍA DE RED CRUCIANELLI',
    '---------------------------------------',
    `PERIODO ANALIZADO: ${fechaInicio} HASTA ${fechaFin}.`,
    '',
    'RESULTADOS OPERATIVOS:',
    `SE HAN PROCESADO UN TOTAL DE ${kpis.total} INTERACCIONES EN LA RED.`,
    `DESGLOSE TÉCNICO: ${kpis.entrantes} LLAMADAS ENTRANTES Y ${kpis.salientes} SALIENTES.`,
    '',
    'EFICIENCIA DE ATENCIÓN:',
    `EL RATIO DE RESPUESTA ALCANZADO ES DEL ${kpis.eficiencia}%.`,
    alertaEficiencia,
  ]

  if (franjas && franjas.length > 0) {
    lines.push('')
    lines.push('ANÁLISIS DE PÉRDIDAS POR FRANJA HORARIA:')
    for (const f of franjas) {
      if (f.total > 0) {
        lines.push(
          `  · ${f.label}: ${f.perdidas} PERDIDAS DE ${f.total} LLAMADAS (${f.porcentaje}%)`
        )
      }
    }
    const franjaConMasPerdidas = [...franjas]
      .filter((f) => f.total > 0)
      .sort((a, b) => b.porcentaje - a.porcentaje)[0]
    if (franjaConMasPerdidas) {
      lines.push(
        `FRANJA CRÍTICA: ${franjaConMasPerdidas.label} CON ${franjaConMasPerdidas.porcentaje}% DE PÉRDIDAS.`
      )
    }
  }

  return lines.join('\n')
}
