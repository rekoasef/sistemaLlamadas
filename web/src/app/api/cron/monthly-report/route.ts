import { NextRequest, NextResponse } from 'next/server'
import { fetchLlamadasByRange } from '@/services/llamadas.service'
import { insertReporte } from '@/services/reportes.service'
import { getSupabaseAdmin } from '@/lib/supabase-admin'
import { calcularKPIs, generarResumenEjecutivo, calcularFugasPorFranja } from '@/lib/kpi'
import { calcularTopConcesionarios } from '@/lib/wallboard'
import { exportarReportePDFComoBase64 } from '@/lib/pdf'
import { enviarReportePorEmail } from '@/lib/email'

const MESES_ES = [
  'ENERO', 'FEBRERO', 'MARZO', 'ABRIL', 'MAYO', 'JUNIO',
  'JULIO', 'AGOSTO', 'SEPTIEMBRE', 'OCTUBRE', 'NOVIEMBRE', 'DICIEMBRE',
]

/**
 * GET /api/cron/monthly-report
 *
 * Generates a full monthly report for the previous calendar month,
 * saves it to DB, generates a PDF and sends it via email.
 *
 * Triggered by Vercel Cron on the 1st of each month at 03:00 UTC (00:00 ART).
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
    // Los crons corren sin sesión: con el cliente compartido serían rol `anon`
    // y RLS rechazaría el insert del reporte con 42501.
    const db = getSupabaseAdmin()

    // Compute previous full month
    const hoy = new Date()
    const mesPrevio = new Date(hoy.getFullYear(), hoy.getMonth() - 1, 1)
    const anio = mesPrevio.getFullYear()
    const mes = mesPrevio.getMonth() // 0-indexed

    const primerDia = new Date(anio, mes, 1)
    const ultimoDia = new Date(anio, mes + 1, 0) // last day of month

    const fechaInicio = primerDia.toISOString().slice(0, 10)
    const fechaFin = ultimoDia.toISOString().slice(0, 10)
    const titulo = `REPORTE MENSUAL — ${MESES_ES[mes]} ${anio}`

    // Fetch and compute
    const llamadas = await fetchLlamadasByRange(fechaInicio, fechaFin, db)
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
    }, db)

    // Generate PDF and send email
    const reporteParaPDF = {
      id: `auto-mensual-${fechaInicio}`,
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

    console.log(`[cron/monthly-report] Enviado: ${titulo} (${fechaInicio} → ${fechaFin})`)
    return NextResponse.json({ ok: true, titulo, fechaInicio, fechaFin, totalLlamadas: llamadas.length })
  } catch (err) {
    console.error('[cron/monthly-report]', err)
    return NextResponse.json(
      { error: err instanceof Error ? err.message : 'Error al generar el reporte mensual' },
      { status: 500 }
    )
  }
}
