import { NextRequest, NextResponse } from 'next/server'
import { enviarReportePorEmail } from '@/lib/email'

/**
 * POST /api/send-report
 *
 * Body: { titulo, periodo, resumen, pdfBase64, destinatarios? }
 * - pdfBase64: base64-encoded PDF (generated client-side with jsPDF)
 * - destinatarios: optional array of email addresses (defaults to DESTINATARIOS_DEFAULT)
 */
export async function POST(req: NextRequest) {
  try {
    const body = await req.json()
    const { titulo, periodo, resumen, pdfBase64, destinatarios } = body

    if (!titulo || !pdfBase64) {
      return NextResponse.json({ error: 'Faltan campos requeridos: titulo y pdfBase64' }, { status: 400 })
    }

    await enviarReportePorEmail({ titulo, periodo: periodo ?? '', resumen: resumen ?? '', pdfBase64, destinatarios })

    return NextResponse.json({ ok: true })
  } catch (err) {
    console.error('[API/send-report]', err)
    return NextResponse.json(
      { error: err instanceof Error ? err.message : 'Error al enviar el correo' },
      { status: 500 }
    )
  }
}
