import { NextRequest, NextResponse } from 'next/server'
import { fetchLlamadasByRange } from '@/services/llamadas.service'
import { insertReporte } from '@/services/reportes.service'
import { calcularKPIs, generarResumenEjecutivo, calcularFugasPorFranja } from '@/lib/kpi'
import { calcularTopConcesionarios } from '@/lib/wallboard'
import { exportarReportePDFComoBase64 } from '@/lib/pdf'
import { enviarReportePorEmail } from '@/lib/email'

/**
 * GET /api/cron/weekly-report
 *
 * Generates a weekly report for the previous Monday–Sunday period,
 * saves it to DB, generates a PDF and sends it via email.
 *
 * Triggered by Vercel Cron every Friday at 22:00 UTC (19:00 ART).
 * Can also be triggered manually with the CRON_SECRET header.
 */
export async function GET(req: NextRequest) {
  // Authorization check — Vercel sends Bearer <CRON_SECRET>
  const authHeader = req.headers.get('authorization')
  const cronSecret = process.env.CRON_SECRET
  if (cronSecret && authHeader !== `Bearer ${cronSecret}`) {
    return NextResponse.json({ error: 'No autorizado' }, { status: 401 })
  }

  try {
    // Compute last week (Mon–Sun)
    const hoy = new Date()
    const diaSemana = hoy.getDay() // 0=Dom, 1=Lun, ..., 5=Vie
    // Go back to last Monday
    const diasHastaLunesAnterior = diaSemana === 0 ? 6 : diaSemana + 6
    const lunesAnterior = new Date(hoy)
    lunesAnterior.setDate(hoy.getDate() - diasHastaLunesAnterior)

    const domingoAnterior = new Date(lunesAnterior)
    domingoAnterior.setDate(lunesAnterior.getDate() + 6)

    const fechaInicio = lunesAnterior.toISOString().slice(0, 10)
    const fechaFin = domingoAnterior.toISOString().slice(0, 10)

    // Week number (ISO week approximation)
    const startOfYear = new Date(lunesAnterior.getFullYear(), 0, 1)
    const weekNum = Math.ceil(
      ((lunesAnterior.getTime() - startOfYear.getTime()) / 86400000 + startOfYear.getDay() + 1) / 7
    )
    const titulo = `REPORTE SEMANAL — SEMANA ${weekNum} ${lunesAnterior.getFullYear()}`

    // Fetch and compute
    const llamadas = await fetchLlamadasByRange(fechaInicio, fechaFin)
    const kpis = calcularKPIs(llamadas)
    const franjas = calcularFugasPorFranja(llamadas)
    const topConcesionarios = calcularTopConcesionarios(llamadas, 10)
    const resumen = generarResumenEjecutivo(kpis, fechaInicio, fechaFin, franjas)

    // Save to DB
    await insertReporte({
      titulo,
      rango_inicio: fechaInicio,
      rango_fin: fechaFin,
      metricas: {
        total: kpis.total,
        entrantes: kpis.entrantes,
        salientes: kpis.salientes,
        atendidas: kpis.atendidas,
        eficiencia: kpis.eficiencia,
        franjas,
        topConcesionarios,
      },
      resumen_escrito: resumen,
      tipo: 'AUTOMATICO',
    })

    // Generate PDF and send email
    const reporteParaPDF = {
      id: `auto-semanal-${fechaInicio}`,
      titulo,
      rango_inicio: fechaInicio,
      rango_fin: fechaFin,
      metricas: {
        total: kpis.total,
        entrantes: kpis.entrantes,
        salientes: kpis.salientes,
        atendidas: kpis.atendidas,
        eficiencia: kpis.eficiencia,
        franjas,
        topConcesionarios,
      },
      resumen_escrito: resumen,
      tipo: 'AUTOMATICO' as const,
      creado_at: new Date().toISOString(),
    }

    const pdfBase64 = exportarReportePDFComoBase64(reporteParaPDF)
    const periodo = `${fechaInicio} — ${fechaFin}`

    await enviarReportePorEmail({
      titulo,
      periodo,
      resumen,
      pdfBase64,
    })

    console.log(`[cron/weekly-report] Enviado: ${titulo} (${fechaInicio} → ${fechaFin})`)
    return NextResponse.json({ ok: true, titulo, fechaInicio, fechaFin, totalLlamadas: llamadas.length })
  } catch (err) {
    console.error('[cron/weekly-report]', err)
    return NextResponse.json(
      { error: err instanceof Error ? err.message : 'Error al generar el reporte semanal' },
      { status: 500 }
    )
  }
}
