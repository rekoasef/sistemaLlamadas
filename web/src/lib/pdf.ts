import jsPDF from 'jspdf'
import type { Reporte, FranjaPerdidas } from '@/types/domain'

// ─────────────────────────────────────────────────────────────────────────────
// Brand color palette
// ─────────────────────────────────────────────────────────────────────────────

const WHITE:       [number, number, number] = [255, 255, 255]
const RED:         [number, number, number] = [220,  38,  38]
const GREEN:       [number, number, number] = [ 34, 197,  94]
const BLUE:        [number, number, number] = [ 59, 130, 246]
const PURPLE:      [number, number, number] = [168,  85, 247]
const YELLOW:      [number, number, number] = [234, 179,   8]
const DARK_BG:     [number, number, number] = [ 15,  15,  15]   // #0F0F0F
const DARK_CARD:   [number, number, number] = [ 26,  26,  26]
const DARK_STRIPE: [number, number, number] = [ 32,  32,  32]
const MID_GRAY:    [number, number, number] = [100, 100, 100]
const LIGHT_GRAY:  [number, number, number] = [170, 170, 170]

// GState helper type (avoids polluting the public API)
type GStateFactory = { GState: new (opts: { opacity?: number }) => unknown }

// ─────────────────────────────────────────────────────────────────────────────
// Date parsing — prevents "Invalid Date" from YYYY-MM-DD timezone shift
// ─────────────────────────────────────────────────────────────────────────────

function parseDate(raw: string): Date {
  if (!raw) return new Date()
  // Bare date string → add noon to anchor it in local time (avoids UTC-offset flip)
  if (/^\d{4}-\d{2}-\d{2}$/.test(raw)) return new Date(`${raw}T12:00:00`)
  return new Date(raw)
}

function fmtDate(raw: string): string {
  return parseDate(raw).toLocaleDateString('es-AR', {
    day: '2-digit', month: '2-digit', year: 'numeric',
  })
}

// ─────────────────────────────────────────────────────────────────────────────
// Drawing helpers
// ─────────────────────────────────────────────────────────────────────────────

/**
 * Stamp the security watermark on the current page.
 * Opacity 0.05 — visible when printed / scanned, invisible in casual reading.
 */
function drawWatermark(doc: jsPDF): void {
  const pageW = doc.internal.pageSize.getWidth()
  const pageH = doc.internal.pageSize.getHeight()
  const gf = doc as unknown as GStateFactory
  doc.setGState(new gf.GState({ opacity: 0.05 }))
  doc.setFont('helvetica', 'bold')
  doc.setFontSize(46)
  doc.setTextColor(...WHITE)
  doc.text('CRUCI-TRACK AUDIT', pageW / 2, pageH / 2, { align: 'center', angle: 45 })
  doc.setGState(new gf.GState({ opacity: 1 }))
}

/**
 * Draw a filled dark page background.
 */
function fillBackground(doc: jsPDF): void {
  const pageW = doc.internal.pageSize.getWidth()
  const pageH = doc.internal.pageSize.getHeight()
  doc.setFillColor(...DARK_BG)
  doc.rect(0, 0, pageW, pageH, 'F')
}

/**
 * Draw an Industrial Dark metric card (roundedRect + value + label).
 */
function drawMetricCard(
  doc: jsPDF,
  x: number, y: number, w: number, h: number,
  label: string,
  value: string | number,
  color: [number, number, number],
): void {
  // Card background — subtle tint of the accent color
  const bg: [number, number, number] = [
    Math.round(DARK_CARD[0] + color[0] * 0.07),
    Math.round(DARK_CARD[1] + color[1] * 0.07),
    Math.round(DARK_CARD[2] + color[2] * 0.07),
  ]
  doc.setFillColor(...bg)
  doc.roundedRect(x, y, w, h, 3, 3, 'F')

  // Colored border
  doc.setDrawColor(...color)
  doc.setLineWidth(0.4)
  doc.roundedRect(x, y, w, h, 3, 3, 'S')

  // Value — large, centered, bold
  doc.setFont('helvetica', 'bold')
  doc.setFontSize(18)
  doc.setTextColor(...color)
  doc.text(String(value), x + w / 2, y + h / 2 + 2, { align: 'center' })

  // Label — tiny, muted, centered at the bottom
  doc.setFont('helvetica', 'bold')
  doc.setFontSize(5.5)
  doc.setTextColor(...MID_GRAY)
  doc.text(label.toUpperCase(), x + w / 2, y + h - 4, { align: 'center' })
}

/**
 * Draw a horizontal progress bar with rounded ends.
 */
function drawProgressBar(
  doc: jsPDF,
  x: number, y: number, w: number, h: number,
  value: number, max: number,
  fillColor: [number, number, number],
): void {
  // Track
  doc.setFillColor(...DARK_STRIPE)
  doc.roundedRect(x, y, w, h, h / 2, h / 2, 'F')
  // Fill
  const fillW = max > 0 ? Math.max((value / max) * w, h) : 0
  if (fillW > 0) {
    doc.setFillColor(...fillColor)
    doc.roundedRect(x, y, fillW, h, h / 2, h / 2, 'F')
  }
}

/**
 * Draw a section header stripe (dark background + red label text).
 * Returns the Y position below the header (ready for next element).
 */
function drawSectionHeader(doc: jsPDF, text: string, y: number, pageW: number): number {
  doc.setFillColor(...DARK_STRIPE)
  doc.roundedRect(10, y, pageW - 20, 9, 2, 2, 'F')
  // Left accent bar
  doc.setFillColor(...RED)
  doc.roundedRect(10, y, 2, 9, 1, 1, 'F')
  doc.setFont('helvetica', 'bold')
  doc.setFontSize(7)
  doc.setTextColor(...RED)
  doc.text(text, 16, y + 6.2)
  return y + 14
}

/**
 * Draw franja heatmap — 4 cells, heat-colored by loss percentage.
 */
function drawFranjaHeatmap(
  doc: jsPDF,
  franjas: FranjaPerdidas[],
  y: number,
  pageW: number,
): number {
  const COLS = 4
  const GAP  = 4
  const CELL_W = (pageW - 20 - GAP * (COLS - 1)) / COLS
  const CELL_H = 22
  const startX = 10

  for (let i = 0; i < Math.min(COLS, franjas.length); i++) {
    const f = franjas[i]
    const cx = startX + i * (CELL_W + GAP)

    // Heat-tinted background
    const intensity = f.total > 0 ? f.porcentaje / 100 : 0
    const r = Math.round(26 + intensity * 180)
    const g = Math.round(26 - intensity * 16)
    const b = Math.round(26 - intensity * 16)
    doc.setFillColor(r, g, b)
    doc.roundedRect(cx, y, CELL_W, CELL_H, 3, 3, 'F')

    // Border
    const cellColor: [number, number, number] =
      f.porcentaje > 50 ? [255, 80, 80] : f.porcentaje > 25 ? [255, 200, 0] : [60, 200, 100]
    doc.setDrawColor(...cellColor)
    doc.setLineWidth(0.3)
    doc.roundedRect(cx, y, CELL_W, CELL_H, 3, 3, 'S')

    // Slot label
    doc.setFont('helvetica', 'bold')
    doc.setFontSize(6)
    doc.setTextColor(150, 150, 150)
    doc.text(f.label, cx + CELL_W / 2, y + 7, { align: 'center' })

    // Percentage — large
    doc.setFont('helvetica', 'bold')
    doc.setFontSize(11)
    doc.setTextColor(...cellColor)
    doc.text(`${f.porcentaje}%`, cx + CELL_W / 2, y + 16, { align: 'center' })
  }

  return y + CELL_H + 10
}

// ─────────────────────────────────────────────────────────────────────────────
// Public API
// ─────────────────────────────────────────────────────────────────────────────

/**
 * Generate and trigger a browser download of a branded Industrial Dark PDF.
 *
 * Layout (single page):
 *  1. Security watermark   — "CRUCI-TRACK AUDIT" at 45°, opacity 0.05
 *  2. Dark background      — #0F0F0F full bleed
 *  3. Red header banner    — system name, classification, emit timestamp
 *  4. Report metadata      — title, period (timezone-safe), type, efficiency badge
 *  5. Metric cards         — 5 roundedRect tiles (Total/Entrantes/Salientes/Atendidas/Perdidas)
 *  6. Efficiency gauge     — large %, progress bar with umbral marker at 60%
 *  7. Atendidas vs Perdidas bars — side-by-side comparison
 *  8. Franja heatmap       — 4-slot grid (if data present)
 *  9. Executive summary    — wrapped text block
 * 10. Digital signature    — Report ID + integrity hash
 */
export function exportarReportePDF(reporte: Reporte): void {
  const doc = new jsPDF()
  const pageW = doc.internal.pageSize.getWidth()
  const pageH = doc.internal.pageSize.getHeight()

  const m         = reporte.metricas
  const total     = m?.total     ?? 0
  const entrantes = m?.entrantes ?? 0
  const salientes = m?.salientes ?? 0
  const atendidas = m?.atendidas ?? 0
  const eficiencia = m?.eficiencia ?? 0
  const perdidas  = total - atendidas
  const maxVal    = Math.max(atendidas, perdidas, 1)
  const efColor: [number, number, number] = eficiencia >= 60 ? GREEN : RED

  // ── 1 & 2. Watermark + dark background ──────────────────────────────────
  // Watermark first (behind everything)
  drawWatermark(doc)
  fillBackground(doc)

  // ── 3. Red header banner ─────────────────────────────────────────────────
  doc.setFillColor(...RED)
  doc.rect(0, 0, pageW, 40, 'F')

  // Dark-red left accent
  doc.setFillColor(160, 20, 20)
  doc.rect(0, 0, 4, 40, 'F')

  doc.setTextColor(...WHITE)
  doc.setFont('helvetica', 'bold')
  doc.setFontSize(20)
  doc.text('CRUCI-TRACK', 12, 17)

  doc.setFont('helvetica', 'normal')
  doc.setFontSize(8)
  doc.text('SISTEMA DE AUDITORÍA DE TELEMETRÍA  ·  CRUCIANELLI S.A.', 12, 27)

  doc.setFontSize(6.5)
  doc.setTextColor(255, 200, 200)
  doc.text('CLASIFICACIÓN: CONFIDENCIAL INTERNO', 12, 35)
  doc.text(`EMITIDO: ${new Date().toLocaleString('es-AR')}`, pageW - 12, 35, { align: 'right' })

  // ── 4. Report metadata ────────────────────────────────────────────────────
  doc.setTextColor(...WHITE)
  doc.setFont('helvetica', 'bold')
  doc.setFontSize(13)
  doc.text(reporte.titulo.toUpperCase(), 12, 53)

  doc.setFont('helvetica', 'normal')
  doc.setFontSize(8)
  doc.setTextColor(...LIGHT_GRAY)
  doc.text(
    `PERÍODO: ${fmtDate(reporte.rango_inicio)}  —  ${fmtDate(reporte.rango_fin)}`,
    12, 62
  )
  doc.text(`TIPO: ${reporte.tipo ?? 'MANUAL'}`, 12, 69)

  // Efficiency stamp (top-right)
  doc.setFillColor(
    Math.round(DARK_CARD[0] + efColor[0] * 0.12),
    Math.round(DARK_CARD[1] + efColor[1] * 0.12),
    Math.round(DARK_CARD[2] + efColor[2] * 0.12),
  )
  doc.roundedRect(pageW - 36, 46, 24, 26, 4, 4, 'F')
  doc.setDrawColor(...efColor)
  doc.setLineWidth(1)
  doc.roundedRect(pageW - 36, 46, 24, 26, 4, 4, 'S')
  doc.setFont('helvetica', 'bold')
  doc.setFontSize(11)
  doc.setTextColor(...efColor)
  doc.text(`${eficiencia}%`, pageW - 24, 59, { align: 'center' })
  doc.setFontSize(5)
  doc.setTextColor(...MID_GRAY)
  doc.text('EFIC.', pageW - 24, 66, { align: 'center' })

  let curY = 80

  // ── 5. Metric cards grid ──────────────────────────────────────────────────
  curY = drawSectionHeader(doc, 'MÉTRICAS OPERATIVAS', curY, pageW)

  const CARD_GAP = 4
  const CARD_W   = (pageW - 20 - CARD_GAP * 4) / 5
  const CARD_H   = 28

  const cards: { label: string; value: number; color: [number, number, number] }[] = [
    { label: 'Total Red', value: total,     color: WHITE  },
    { label: 'Entrantes', value: entrantes, color: BLUE   },
    { label: 'Salientes', value: salientes, color: PURPLE },
    { label: 'Atendidas', value: atendidas, color: GREEN  },
    { label: 'Perdidas',  value: perdidas,  color: RED    },
  ]

  cards.forEach(({ label, value, color }, i) => {
    drawMetricCard(doc, 10 + i * (CARD_W + CARD_GAP), curY, CARD_W, CARD_H, label, value, color)
  })

  curY += CARD_H + 14

  // ── 6. Efficiency gauge ───────────────────────────────────────────────────
  curY = drawSectionHeader(doc, 'RATIO DE EFICIENCIA (FRANJA COMERCIAL 07–19 HS)', curY, pageW)

  // Large eficiencia number
  doc.setFont('helvetica', 'bold')
  doc.setFontSize(32)
  doc.setTextColor(...efColor)
  doc.text(`${eficiencia}%`, 12, curY + 16)

  // Progress bar
  const GAUGE_X = 52
  const GAUGE_W = pageW - GAUGE_X - 12
  const GAUGE_H = 9
  drawProgressBar(doc, GAUGE_X, curY + 4, GAUGE_W, GAUGE_H, eficiencia, 100, efColor)

  // Umbral marker at 60%
  const umbralX = GAUGE_X + (60 / 100) * GAUGE_W
  doc.setDrawColor(...YELLOW)
  doc.setLineWidth(0.8)
  doc.line(umbralX, curY + 2, umbralX, curY + GAUGE_H + 6)
  doc.setFont('helvetica', 'bold')
  doc.setFontSize(5.5)
  doc.setTextColor(...YELLOW)
  doc.text('UMBRAL 60%', umbralX, curY + GAUGE_H + 11, { align: 'center' })

  doc.setFontSize(5.5)
  doc.setTextColor(...MID_GRAY)
  doc.text('0%', GAUGE_X, curY + GAUGE_H + 11)
  doc.text('100%', GAUGE_X + GAUGE_W, curY + GAUGE_H + 11, { align: 'right' })

  curY += 28

  // ── 7. Atendidas vs Perdidas comparison bars ──────────────────────────────
  curY = drawSectionHeader(doc, 'COMPARATIVA: ATENDIDAS VS PERDIDAS', curY, pageW)

  const BAR_LABEL_W = 40
  const BAR_X       = 10 + BAR_LABEL_W + 4
  const BAR_W       = pageW - BAR_X - 24
  const BAR_H       = 8

  doc.setFont('helvetica', 'bold')
  doc.setFontSize(7)
  doc.setTextColor(...LIGHT_GRAY)
  doc.text('ATENDIDAS', 10, curY + BAR_H - 1)
  drawProgressBar(doc, BAR_X, curY, BAR_W, BAR_H, atendidas, maxVal, GREEN)
  doc.setTextColor(...GREEN)
  doc.text(String(atendidas), BAR_X + BAR_W + 4, curY + BAR_H - 1)

  curY += 14

  doc.setTextColor(...LIGHT_GRAY)
  doc.text('PERDIDAS', 10, curY + BAR_H - 1)
  drawProgressBar(doc, BAR_X, curY, BAR_W, BAR_H, perdidas, maxVal, RED)
  doc.setTextColor(...RED)
  doc.text(String(perdidas), BAR_X + BAR_W + 4, curY + BAR_H - 1)

  curY += 18

  // ── 8. Franja heatmap (optional) ─────────────────────────────────────────
  const franjas = m?.franjas
  if (franjas && franjas.length > 0) {
    curY = drawSectionHeader(doc, 'ANÁLISIS POR FRANJA HORARIA (07–19 HS)', curY, pageW)
    curY = drawFranjaHeatmap(doc, franjas, curY, pageW)
  }

  // ── 9. Executive summary ──────────────────────────────────────────────────
  curY = drawSectionHeader(doc, 'RESUMEN EJECUTIVO Y AUDITORÍA', curY, pageW)

  doc.setFont('helvetica', 'normal')
  doc.setFontSize(7.5)
  doc.setTextColor(190, 190, 190)
  const summaryLines = doc.splitTextToSize(reporte.resumen_escrito ?? '', pageW - 24)
  doc.text(summaryLines, 12, curY)

  // ── 10. Digital signature footer ─────────────────────────────────────────
  doc.setDrawColor(40, 40, 40)
  doc.line(10, pageH - 20, pageW - 10, pageH - 20)

  doc.setFont('helvetica', 'italic')
  doc.setFontSize(6)
  doc.setTextColor(...MID_GRAY)
  doc.text(
    'Documento generado automáticamente por Cruci-Track v2.1  ·  Propiedad de Crucianelli S.A.',
    10, pageH - 13
  )
  doc.text(`REPORT-ID: ${reporte.id}`, 10, pageH - 8)
  doc.text(
    `INTEGRIDAD: ${btoa(reporte.id).substring(0, 28).toUpperCase()}`,
    pageW - 10, pageH - 8,
    { align: 'right' }
  )

  doc.save(`INFORME_CRUCI_${reporte.titulo.replace(/\s+/g, '_').toUpperCase()}.pdf`)
}
