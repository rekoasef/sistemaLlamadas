import { NextRequest, NextResponse } from 'next/server'
import { getSupabaseAdmin } from '@/lib/supabase-admin'
import { dispositivoDesdeRequest } from '@/lib/dispositivo-token'
import { serverError, unauthorized } from '@/lib/api-auth'

const ESTADOS = new Set(['ONLINE', 'SIN_PERMISOS'])

/**
 * POST /api/ingest/heartbeat — la app Android (v2+) reporta que sigue viva.
 *
 * Header: Authorization: Bearer <token del dispositivo>
 * Body: { status: 'ONLINE' | 'SIN_PERMISOS' }
 *
 * terminal_id sale del token y last_seen es la hora del servidor (no se confía
 * en el reloj del teléfono). OFFLINE lo pone el pg_cron mark-offline-terminals.
 */
export async function POST(req: NextRequest) {
  try {
    const terminalId = await dispositivoDesdeRequest(req)
    if (!terminalId) return unauthorized()

    const body = await req.json().catch(() => null)
    if (!ESTADOS.has(body?.status)) {
      return NextResponse.json({ error: 'Payload inválido' }, { status: 400 })
    }

    const { error } = await getSupabaseAdmin()
      .from('terminal_status')
      .upsert(
        { terminal_id: terminalId, status: body.status, last_seen: new Date().toISOString() },
        { onConflict: 'terminal_id' }
      )
    if (error) throw error

    return NextResponse.json({ ok: true })
  } catch (err) {
    return serverError('[API/ingest/heartbeat]', err, 'Error al registrar el heartbeat')
  }
}
