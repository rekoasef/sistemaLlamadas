import { NextRequest, NextResponse } from 'next/server'
import { getSupabaseAdmin } from '@/lib/supabase-admin'
import { DISPOSITIVO_ID_RE, generarToken, hashToken } from '@/lib/dispositivo-token'
import { hasUserSession, serverError, unauthorized } from '@/lib/api-auth'

/**
 * GET /api/dispositivos/token — qué terminales tienen token y cuándo se usó.
 * Nunca devuelve tokens ni hashes.
 */
export async function GET() {
  if (!(await hasUserSession())) return unauthorized()
  try {
    const { data, error } = await getSupabaseAdmin()
      .from('dispositivo_tokens')
      .select('dispositivo_id, creado_at, ultimo_uso_at')
    if (error) throw error
    return NextResponse.json({ tokens: data ?? [] })
  } catch (err) {
    return serverError('[API/dispositivos/token]', err, 'Error al leer los tokens')
  }
}

/**
 * POST /api/dispositivos/token — genera el token de una terminal.
 * Body: { dispositivoId }. Si ya tenía uno, queda revocado.
 * El token se devuelve UNA sola vez; en la base queda solo el hash.
 */
export async function POST(req: NextRequest) {
  if (!req.headers.get('content-type')?.startsWith('application/json')) {
    return NextResponse.json({ error: 'Content-Type debe ser application/json' }, { status: 415 })
  }
  if (!(await hasUserSession())) return unauthorized()

  try {
    const body = await req.json().catch(() => null)
    const dispositivoId = body?.dispositivoId
    if (typeof dispositivoId !== 'string' || !DISPOSITIVO_ID_RE.test(dispositivoId)) {
      return NextResponse.json({ error: 'ID de terminal inválido (letras, números, - y _)' }, { status: 400 })
    }

    const token = generarToken()
    const { error } = await getSupabaseAdmin()
      .from('dispositivo_tokens')
      .upsert(
        {
          dispositivo_id: dispositivoId,
          token_hash: hashToken(token),
          creado_at: new Date().toISOString(),
          ultimo_uso_at: null,
        },
        { onConflict: 'dispositivo_id' }
      )
    if (error) throw error

    return NextResponse.json({ dispositivoId, token })
  } catch (err) {
    return serverError('[API/dispositivos/token]', err, 'Error al generar el token')
  }
}
