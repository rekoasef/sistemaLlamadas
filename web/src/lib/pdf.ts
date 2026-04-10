import jsPDF, { GState } from 'jspdf'
import type { Reporte, FranjaPerdidas } from '@/types/domain'
import { UMBRAL_EFICIENCIA } from '@/lib/kpi'

// ─────────────────────────────────────────────────────────────────────────────
// Brand color palette
// ─────────────────────────────────────────────────────────────────────────────

const WHITE:       [number, number, number] = [255, 255, 255]
const RED:         [number, number, number] = [220,  38,  38]
const GREEN:       [number, number, number] = [ 34, 197,  94]
const BLUE:        [number, number, number] = [ 59, 130, 246]
const PURPLE:      [number, number, number] = [168,  85, 247]
const YELLOW:      [number, number, number] = [234, 179,   8]
const DARK_BG:     [number, number, number] = [ 15,  15,  15]
const DARK_CARD:   [number, number, number] = [ 26,  26,  26]
const DARK_STRIPE: [number, number, number] = [ 32,  32,  32]
const MID_GRAY:    [number, number, number] = [100, 100, 100]
const LIGHT_GRAY:  [number, number, number] = [170, 170, 170]

// ─────────────────────────────────────────────────────────────────────────────
// Date helpers
// ─────────────────────────────────────────────────────────────────────────────

function parseDate(raw: string | null | undefined): Date {
  if (!raw) return new Date()
  if (/^\d{4}-\d{2}-\d{2}$/.test(raw)) return new Date(`${raw}T12:00:00`)
  return new Date(raw)
}

function fmtDate(raw: string | null | undefined): string {
  const d = parseDate(raw)
  if (isNaN(d.getTime())) return '—'
  return d.toLocaleDateString('es-AR', { day: '2-digit', month: '2-digit', year: 'numeric' })
}

// ─────────────────────────────────────────────────────────────────────────────
// Page setup helpers
// ─────────────────────────────────────────────────────────────────────────────

/** Fill the current page with the dark background. */
function fillBackground(doc: jsPDF): void {
  const W = doc.internal.pageSize.getWidth()
  const H = doc.internal.pageSize.getHeight()
  doc.setFillColor(...DARK_BG)
  doc.rect(0, 0, W, H, 'F')
}

/** Draw diagonal watermark on the current page. */
function drawWatermark(doc: jsPDF): void {
  const W = doc.internal.pageSize.getWidth()
  const H = doc.internal.pageSize.getHeight()
  doc.setGState(new GState({ opacity: 0.05 }))
  doc.setFont('helvetica', 'bold')
  doc.setFontSize(46)
  doc.setTextColor(...WHITE)
  doc.text('CRUCI-TRACK AUDIT', W / 2, H / 2, { align: 'center', angle: 45 })
  doc.setGState(new GState({ opacity: 1 }))
}

/**
 * Add a new page with dark background, watermark and a thin red left accent.
 * Returns the Y coordinate where content should start.
 */
function newPage(doc: jsPDF): number {
  doc.addPage()
  fillBackground(doc)
  drawWatermark(doc)
  const H = doc.internal.pageSize.getHeight()
  doc.setFillColor(...RED)
  doc.rect(0, 0, 3, H, 'F')
  doc.setFont('helvetica', 'italic')
  doc.setFontSize(5.5)
  doc.setTextColor(55, 55, 55)
  const W = doc.internal.pageSize.getWidth()
  doc.text('CRUCI-TRACK  ·  CONTINUACIÓN', W / 2, 9, { align: 'center' })
  return 18
}

/**
 * If curY + neededMM would overflow the printable area, add a new page.
 * footerReserve is the mm to keep free at the bottom for the footer.
 */
function guard(doc: jsPDF, curY: number, neededMM: number, footerReserve = 26): number {
  const H = doc.internal.pageSize.getHeight()
  if (curY + neededMM > H - footerReserve) {
    return newPage(doc)
  }
  return curY
}

// ─────────────────────────────────────────────────────────────────────────────
// Section / drawing helpers
// ─────────────────────────────────────────────────────────────────────────────

function drawSectionHeader(doc: jsPDF, text: string, y: number): number {
  const W = doc.internal.pageSize.getWidth()
  doc.setFillColor(...DARK_STRIPE)
  doc.roundedRect(10, y, W - 20, 9, 2, 2, 'F')
  doc.setFillColor(...RED)
  doc.roundedRect(10, y, 2, 9, 1, 1, 'F')
  doc.setFont('helvetica', 'bold')
  doc.setFontSize(7)
  doc.setTextColor(...RED)
  doc.text(text, 16, y + 6.2)
  return y + 14
}

function drawMetricCard(
  doc: jsPDF,
  x: number, y: number, w: number, h: number,
  label: string, value: string | number,
  color: [number, number, number],
): void {
  const bg: [number, number, number] = [
    Math.round(DARK_CARD[0] + color[0] * 0.07),
    Math.round(DARK_CARD[1] + color[1] * 0.07),
    Math.round(DARK_CARD[2] + color[2] * 0.07),
  ]
  doc.setFillColor(...bg)
  doc.roundedRect(x, y, w, h, 3, 3, 'F')
  doc.setDrawColor(...color)
  doc.setLineWidth(0.4)
  doc.roundedRect(x, y, w, h, 3, 3, 'S')
  doc.setFont('helvetica', 'bold')
  doc.setFontSize(18)
  doc.setTextColor(...color)
  doc.text(String(value), x + w / 2, y + h / 2 + 2, { align: 'center' })
  doc.setFont('helvetica', 'bold')
  doc.setFontSize(5.5)
  doc.setTextColor(...MID_GRAY)
  doc.text(label.toUpperCase(), x + w / 2, y + h - 4, { align: 'center' })
}

function drawProgressBar(
  doc: jsPDF,
  x: number, y: number, w: number, h: number,
  value: number, max: number,
  fillColor: [number, number, number],
): void {
  doc.setFillColor(...DARK_STRIPE)
  doc.roundedRect(x, y, w, h, h / 2, h / 2, 'F')
  const fillW = max > 0 ? Math.max((value / max) * w, h) : 0
  if (fillW > 0) {
    doc.setFillColor(...fillColor)
    doc.roundedRect(x, y, fillW, h, h / 2, h / 2, 'F')
  }
}

function drawFranjaHeatmap(doc: jsPDF, franjas: FranjaPerdidas[], y: number): number {
  const W = doc.internal.pageSize.getWidth()
  const COLS = 4
  const GAP  = 4
  const CELL_W = (W - 20 - GAP * (COLS - 1)) / COLS
  const CELL_H = 22

  for (let i = 0; i < Math.min(COLS, franjas.length); i++) {
    const f = franjas[i]
    const cx = 10 + i * (CELL_W + GAP)
    const intensity = f.total > 0 ? f.porcentaje / 100 : 0
    const r = Math.round(26 + intensity * 180)
    const g = Math.round(26 - intensity * 16)
    const b = Math.round(26 - intensity * 16)
    doc.setFillColor(r, g, b)
    doc.roundedRect(cx, y, CELL_W, CELL_H, 3, 3, 'F')
    const cellColor: [number, number, number] =
      f.porcentaje > 50 ? [255, 80, 80] : f.porcentaje > 25 ? [255, 200, 0] : [60, 200, 100]
    doc.setDrawColor(...cellColor)
    doc.setLineWidth(0.3)
    doc.roundedRect(cx, y, CELL_W, CELL_H, 3, 3, 'S')
    doc.setFont('helvetica', 'bold')
    doc.setFontSize(6)
    doc.setTextColor(150, 150, 150)
    doc.text(f.label, cx + CELL_W / 2, y + 7, { align: 'center' })
    doc.setFontSize(11)
    doc.setTextColor(...cellColor)
    doc.text(`${f.porcentaje}%`, cx + CELL_W / 2, y + 16, { align: 'center' })
  }
  return y + CELL_H + 10
}

/**
 * Draw top concesionarios list, adding new pages whenever a row doesn't fit.
 * Each row is ~12mm; we check before drawing each one.
 */
function drawTopConcesionarios(
  doc: jsPDF,
  top: { nombre: string; total: number }[],
  y: number,
): number {
  if (top.length === 0) return y

  const W = doc.internal.pageSize.getWidth()
  const maxTotal = top[0].total
  const ROW_H = 9
  const BAR_X = 50
  const BAR_W = W - BAR_X - 22
  const GAP = 3

  for (let i = 0; i < Math.min(10, top.length); i++) {
    // Ensure room for this row before drawing it
    y = guard(doc, y, ROW_H + GAP + 2)

    const item = top[i]
    const barFill = maxTotal > 0 ? (item.total / maxTotal) * BAR_W : 0
    const isTop3 = i < 3

    doc.setFont('helvetica', 'bold')
    doc.setFontSize(5.5)
    doc.setTextColor(...(isTop3 ? RED : [70, 70, 70] as [number, number, number]))
    doc.text(`${i + 1}.`, 12, y + 6)

    doc.setFontSize(6)
    doc.setTextColor(...LIGHT_GRAY)
    const nameTrunc = item.nombre.length > 28 ? item.nombre.substring(0, 27) + '…' : item.nombre
    doc.text(nameTrunc.toUpperCase(), 18, y + 6)

    doc.setFillColor(...DARK_STRIPE)
    doc.roundedRect(BAR_X, y + 1.5, BAR_W, 4, 1, 1, 'F')

    if (barFill > 0) {
      const fc: [number, number, number] = isTop3 ? RED : [70, 70, 70]
      doc.setFillColor(...fc)
      doc.roundedRect(BAR_X, y + 1.5, barFill, 4, 1, 1, 'F')
    }

    doc.setFont('helvetica', 'bold')
    doc.setFontSize(6)
    doc.setTextColor(...(isTop3 ? RED : [100, 100, 100] as [number, number, number]))
    doc.text(String(item.total), BAR_X + BAR_W + 4, y + 6)

    y += ROW_H + GAP
  }

  return y + 4
}

/** Draw the footer on the current (last) page. */
function drawFooter(doc: jsPDF, reporteId: string): void {
  const W = doc.internal.pageSize.getWidth()
  const H = doc.internal.pageSize.getHeight()
  doc.setDrawColor(40, 40, 40)
  doc.line(10, H - 18, W - 10, H - 18)
  doc.setFont('helvetica', 'italic')
  doc.setFontSize(6)
  doc.setTextColor(...MID_GRAY)
  doc.text(
    'Documento generado automáticamente por Cruci-Track v2.2  ·  Propiedad de Crucianelli S.A.',
    10, H - 11,
  )
  doc.text(`REPORT-ID: ${reporteId}`, 10, H - 6)
  doc.text(
    `INTEGRIDAD: ${btoa(reporteId).substring(0, 28).toUpperCase()}`,
    W - 10, H - 6,
    { align: 'right' },
  )
}

// ─────────────────────────────────────────────────────────────────────────────
// Shared PDF builder — returns the jsPDF instance (no side effects)
// ─────────────────────────────────────────────────────────────────────────────

function buildReportePDF(reporte: Reporte): jsPDF {
  const doc = new jsPDF()
  const pageW = doc.internal.pageSize.getWidth()

  const m          = reporte.metricas
  const total      = m?.total      ?? 0
  const entrantes  = m?.entrantes  ?? 0
  const salientes  = m?.salientes  ?? 0
  const atendidas  = m?.atendidas  ?? 0
  const eficiencia = m?.eficiencia ?? 0
  const perdidas   = total - atendidas
  const maxVal     = Math.max(atendidas, perdidas, 1)
  const efColor: [number, number, number] = eficiencia >= UMBRAL_EFICIENCIA ? GREEN : RED

  // ═══════════════════════════════════════════════════════════════════
  // PAGE 1 — Fixed sections (always fit: header ~80 + content ~185)
  // ═══════════════════════════════════════════════════════════════════

  fillBackground(doc)
  drawWatermark(doc)

  // ── Header banner ────────────────────────────────────────────────
  doc.setFillColor(...RED)
  doc.rect(0, 0, pageW, 40, 'F')
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

  // ── Report metadata ───────────────────────────────────────────────
  doc.setTextColor(...WHITE)
  doc.setFont('helvetica', 'bold')
  doc.setFontSize(13)
  doc.text(reporte.titulo.toUpperCase(), 12, 53)
  doc.setFont('helvetica', 'normal')
  doc.setFontSize(8)
  doc.setTextColor(...LIGHT_GRAY)
  doc.text(`PERÍODO: ${fmtDate(reporte.rango_inicio)}  —  ${fmtDate(reporte.rango_fin)}`, 12, 62)
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

  // ── Section A: Metric cards  (y: 80 → 136) ───────────────────────
  let y = drawSectionHeader(doc, 'MÉTRICAS OPERATIVAS', 80)

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
  cards.forEach(({ label, value, color }, i) =>
    drawMetricCard(doc, 10 + i * (CARD_W + CARD_GAP), y, CARD_W, CARD_H, label, value, color)
  )
  y += CARD_H + 14   // y ≈ 136

  // ── Section B: Efficiency gauge  (y: 136 → 178) ──────────────────
  y = drawSectionHeader(doc, 'RATIO DE EFICIENCIA (FRANJA COMERCIAL 07–19 HS)', y)

  doc.setFont('helvetica', 'bold')
  doc.setFontSize(32)
  doc.setTextColor(...efColor)
  doc.text(`${eficiencia}%`, 12, y + 16)

  const GAUGE_X = 52
  const GAUGE_W = pageW - GAUGE_X - 12
  const GAUGE_H = 9
  drawProgressBar(doc, GAUGE_X, y + 4, GAUGE_W, GAUGE_H, eficiencia, 100, efColor)

  const umbralX = GAUGE_X + (UMBRAL_EFICIENCIA / 100) * GAUGE_W
  doc.setDrawColor(...YELLOW)
  doc.setLineWidth(0.8)
  doc.line(umbralX, y + 2, umbralX, y + GAUGE_H + 6)
  doc.setFont('helvetica', 'bold')
  doc.setFontSize(5.5)
  doc.setTextColor(...YELLOW)
  doc.text(`UMBRAL ${UMBRAL_EFICIENCIA}%`, umbralX, y + GAUGE_H + 11, { align: 'center' })
  doc.setFontSize(5.5)
  doc.setTextColor(...MID_GRAY)
  doc.text('0%', GAUGE_X, y + GAUGE_H + 11)
  doc.text('100%', GAUGE_X + GAUGE_W, y + GAUGE_H + 11, { align: 'right' })

  y += 28   // y ≈ 178

  // ── Section C: Atendidas vs Perdidas  (y: 178 → 224) ─────────────
  y = drawSectionHeader(doc, 'COMPARATIVA: ATENDIDAS VS PERDIDAS', y)

  const BAR_LABEL_W = 40
  const BAR_X       = 10 + BAR_LABEL_W + 4
  const BAR_W       = pageW - BAR_X - 24
  const BAR_H       = 8

  doc.setFont('helvetica', 'bold')
  doc.setFontSize(7)
  doc.setTextColor(...LIGHT_GRAY)
  doc.text('ATENDIDAS', 10, y + BAR_H - 1)
  drawProgressBar(doc, BAR_X, y, BAR_W, BAR_H, atendidas, maxVal, GREEN)
  doc.setTextColor(...GREEN)
  doc.text(String(atendidas), BAR_X + BAR_W + 4, y + BAR_H - 1)
  y += 14

  doc.setTextColor(...LIGHT_GRAY)
  doc.text('PERDIDAS', 10, y + BAR_H - 1)
  drawProgressBar(doc, BAR_X, y, BAR_W, BAR_H, perdidas, maxVal, RED)
  doc.setTextColor(...RED)
  doc.text(String(perdidas), BAR_X + BAR_W + 4, y + BAR_H - 1)
  y += 14   // y ≈ 206

  // ═══════════════════════════════════════════════════════════════════
  // PAGE 2 — Variable sections (franja, top 10, resumen)
  // Always start a new page here so sections never get clipped.
  // ═══════════════════════════════════════════════════════════════════

  y = newPage(doc)

  // ── Section D: Franja heatmap ─────────────────────────────────────
  const franjas = m?.franjas
  if (franjas && franjas.length > 0) {
    y = guard(doc, y, 46)
    y = drawSectionHeader(doc, 'ANÁLISIS POR FRANJA HORARIA (07–19 HS)', y)
    y = drawFranjaHeatmap(doc, franjas, y)
  }

  // ── Section E: Top 10 concesionarios ─────────────────────────────
  const topConces = m?.topConcesionarios
  if (topConces && topConces.length > 0) {
    y = guard(doc, y, 28)   // room for header + at least 1 row
    y = drawSectionHeader(doc, 'TOP 10 CONCESIONARIOS POR ACTIVIDAD', y)
    y = drawTopConcesionarios(doc, topConces, y)
  }

  // ── Section F: Executive summary (line-by-line with page breaks) ──
  const summaryText = reporte.resumen_escrito ?? ''
  if (summaryText) {
    y = guard(doc, y, 22)
    y = drawSectionHeader(doc, 'RESUMEN EJECUTIVO Y AUDITORÍA', y)

    const LINE_H   = 4.6
    const LINE_GAP = 0.8
    const allLines: string[] = doc.splitTextToSize(summaryText, pageW - 24)

    for (const line of allLines) {
      y = guard(doc, y, LINE_H + LINE_GAP + 2)
      doc.setFont('helvetica', 'normal')
      doc.setFontSize(7.5)
      doc.setTextColor(190, 190, 190)
      doc.text(line, 12, y)
      y += LINE_H + LINE_GAP
    }
  }

  // ── Footer (last page only) ───────────────────────────────────────
  drawFooter(doc, reporte.id)

  return doc
}

// ─────────────────────────────────────────────────────────────────────────────
// Public API
// ─────────────────────────────────────────────────────────────────────────────

/**
 * Generate and trigger a browser download of a branded Industrial Dark PDF.
 */
export function exportarReportePDF(reporte: Reporte): void {
  const doc = buildReportePDF(reporte)
  doc.save(`INFORME_CRUCI_${reporte.titulo.replace(/\s+/g, '_').toUpperCase()}.pdf`)
}

/**
 * Generate the PDF and return it as a base64 string for email attachment.
 * Works in both browser (jsPDF native) and Node.js (Next.js API routes).
 */
export function exportarReportePDFComoBase64(reporte: Reporte): string {
  const doc = buildReportePDF(reporte)
  const bytes = new Uint8Array(doc.output('arraybuffer'))
  let binary = ''
  for (let i = 0; i < bytes.byteLength; i++) {
    binary += String.fromCharCode(bytes[i])
  }
  return btoa(binary)
}
