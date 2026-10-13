import { NextRequest, NextResponse } from 'next/server'
import { getSupabaseAdmin } from '@/lib/supabase-admin'
import { dispositivoDesdeRequest } from '@/lib/dispositivo-token'
import { serverError, unauthorized } from '@/lib/api-auth'

const UUID_RE = /^[0-9a-f]{8}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{12}$/i
const TIPOS = new Set(['ENTRANTE', 'SALIENTE'])
const ESTADOS = new Set(['ATENDIDA', 'PERDIDA'])
const MAX_ATRASO_MS = 60 * 24 * 60 * 60 * 1000 // la app puede encolar llamadas sin red
const MAX_ADELANTO_MS = 10 * 60 * 1000         // tolerancia al reloj del teléfono

/**
 * POST /api/ingest/llamada — la app Android (v2+) registra una llamada.
 *
 * Header: Authorization: Bearer <token del dispositivo>
 * Body: { id, numero_telefono, tipo_llamada, duracion_segundos, estado, fecha_llamada }
 *
 * - El dispositivo_id sale del token, no del body.
 * - `id` lo genera la app: un reintento con el mismo id no duplica la llamada.
 * - Escribe con service role; el trigger de la base vincula el concesionario.
 */
export async function POST(req: NextRequest) {
  try {
    const dispositivoId = await dispositivoDesdeRequest(req)
    if (!dispositivoId) return unauthorized()

    const body = await req.json().catch(() => null)
    const { id, numero_telefono, tipo_llamada, duracion_segundos, estado, fecha_llamada } = body ?? {}
    const fecha = typeof fecha_llamada === 'string' ? Date.parse(fecha_llamada) : NaN
    const ahora = Date.now()

    if (
      typeof id !== 'string' || !UUID_RE.test(id) ||
      typeof numero_telefono !== 'string' || numero_telefono.length > 40 ||
      !TIPOS.has(tipo_llamada) ||
      !Number.isInteger(duracion_segundos) || duracion_segundos < 0 || duracion_segundos > 86_400 ||
      !ESTADOS.has(estado) ||
      Number.isNaN(fecha) || fecha > ahora + MAX_ADELANTO_MS || fecha < ahora - MAX_ATRASO_MS
    ) {
      return NextResponse.json({ error: 'Payload inválido' }, { status: 400 })
    }

    const { error } = await getSupabaseAdmin()
      .from('llamadas')
      .upsert(
        {
          id,
          numero_telefono,
          tipo_llamada,
          duracion_segundos,
          estado,
          fecha_llamada: new Date(fecha).toISOString(),
          dispositivo_id: dispositivoId,
        },
        { onConflict: 'id', ignoreDuplicates: true }
      )
    if (error) throw error

    return NextResponse.json({ ok: true }, { status: 201 })
  } catch (err) {
    return serverError('[API/ingest/llamada]', err, 'Error al registrar la llamada')
  }
}
