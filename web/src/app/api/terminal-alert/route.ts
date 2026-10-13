import { NextRequest, NextResponse } from 'next/server'
import { enviarAlertaTerminal } from '@/lib/email'
import { getSupabaseAdmin } from '@/lib/supabase-admin'
import { isWebhookAuthorized, serverError, unauthorized } from '@/lib/api-auth'

/**
 * POST /api/terminal-alert
 *
 * Llamado por el Supabase Database Webhook cuando se inserta una fila
 * en terminal_status_history (= cambio real de estado de una terminal).
 *
 * Supabase envía el header `x-webhook-secret` para autenticar. Sin
 * TERMINAL_ALERT_WEBHOOK_SECRET configurado se rechaza todo.
 */
export async function POST(req: NextRequest) {
  // Verificar el secret para que nadie externo pueda disparar alertas
  if (!isWebhookAuthorized(req.headers.get('x-webhook-secret'))) return unauthorized()

  try {
    const body = await req.json().catch(() => null)
    const record = body?.record as {
      terminal_id: unknown
      status_previo: unknown
      status_nuevo: unknown
      created_at: unknown
    } | undefined

    if (
      typeof record?.terminal_id !== 'string' ||
      typeof record.status_nuevo !== 'string' ||
      typeof record.created_at !== 'string' ||
      (record.status_previo !== null && typeof record.status_previo !== 'string')
    ) {
      return NextResponse.json({ error: 'Payload inválido' }, { status: 400 })
    }

    // Service role: el webhook no tiene sesión, y dispositivo_alias no tiene por
    // qué quedar legible para anon.
    const { data: aliasData } = await getSupabaseAdmin()
      .from('dispositivo_alias')
      .select('alias')
      .eq('dispositivo_id', record.terminal_id)
      .maybeSingle()

    await enviarAlertaTerminal({
      terminalId:   record.terminal_id,
      alias:        aliasData?.alias,
      statusPrevio: record.status_previo,
      statusNuevo:  record.status_nuevo,
      timestamp:    record.created_at,
    })

    return NextResponse.json({ ok: true })
  } catch (err) {
    return serverError('[API/terminal-alert]', err, 'Error interno')
  }
}
