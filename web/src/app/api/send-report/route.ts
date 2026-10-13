import { NextRequest, NextResponse } from 'next/server'
import { enviarReportePorEmail } from '@/lib/email'
import { hasUserSession, serverError, unauthorized } from '@/lib/api-auth'

const MAX_PDF_BYTES = 10 * 1024 * 1024

/**
 * POST /api/send-report
 *
 * Body: { titulo, periodo, resumen, pdfBase64 }
 * - pdfBase64: base64-encoded PDF (generated client-side with jsPDF)
 *
 * Requiere sesión. Los destinatarios los fija el servidor (DESTINATARIOS_DEFAULT):
 * si vinieran del body, el endpoint serviría para mandar mails desde la cuenta
 * corporativa a cualquier dirección.
 */
export async function POST(req: NextRequest) {
  // Un form cross-site no puede mandar application/json sin preflight CORS.
  if (!req.headers.get('content-type')?.startsWith('application/json')) {
    return NextResponse.json({ error: 'Content-Type debe ser application/json' }, { status: 415 })
  }

  if (!(await hasUserSession())) return unauthorized()

  try {
    const body = await req.json().catch(() => null)
    const { titulo, periodo, resumen, pdfBase64 } = body ?? {}

    if (typeof titulo !== 'string' || !titulo.trim() || titulo.length > 200) {
      return NextResponse.json({ error: 'titulo inválido' }, { status: 400 })
    }
    if (periodo !== undefined && (typeof periodo !== 'string' || periodo.length > 100)) {
      return NextResponse.json({ error: 'periodo inválido' }, { status: 400 })
    }
    if (resumen !== undefined && (typeof resumen !== 'string' || resumen.length > 20_000)) {
      return NextResponse.json({ error: 'resumen inválido' }, { status: 400 })
    }
    if (typeof pdfBase64 !== 'string' || !pdfBase64) {
      return NextResponse.json({ error: 'pdfBase64 inválido' }, { status: 400 })
    }

    const pdf = Buffer.from(pdfBase64, 'base64')
    if (pdf.length > MAX_PDF_BYTES || pdf.subarray(0, 5).toString('latin1') !== '%PDF-') {
      return NextResponse.json({ error: 'El adjunto no es un PDF válido' }, { status: 400 })
    }

    await enviarReportePorEmail({ titulo, periodo: periodo ?? '', resumen: resumen ?? '', pdfBase64 })

    return NextResponse.json({ ok: true })
  } catch (err) {
    return serverError('[API/send-report]', err, 'Error al enviar el correo')
  }
}
