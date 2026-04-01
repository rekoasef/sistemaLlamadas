import { NextResponse } from 'next/server'
import { enviarEmailPrueba } from '@/lib/email'

/**
 * GET /api/test-email
 *
 * Dispara un email de prueba a todos los destinatarios configurados.
 * Usar para verificar credenciales Gmail y entrega.
 */
export async function GET() {
  try {
    await enviarEmailPrueba()
    return NextResponse.json({ ok: true, message: 'Email de prueba enviado correctamente a todos los destinatarios.' })
  } catch (err) {
    console.error('[API/test-email]', err)
    return NextResponse.json(
      { error: err instanceof Error ? err.message : 'Error al enviar el email de prueba' },
      { status: 500 }
    )
  }
}
