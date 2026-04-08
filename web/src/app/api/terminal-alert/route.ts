import { NextRequest, NextResponse } from 'next/server'
import { createClient } from '@supabase/supabase-js'
import { enviarAlertaTerminal } from '@/lib/email'

const WEBHOOK_SECRET = process.env.TERMINAL_ALERT_WEBHOOK_SECRET ?? ''

/**
 * POST /api/terminal-alert
 *
 * Llamado por el Supabase Database Webhook cuando se inserta una fila
 * en terminal_status_history (= cambio real de estado de una terminal).
 *
 * Supabase envía el header `x-webhook-secret` para autenticar.
 */
export async function POST(req: NextRequest) {
  // Verificar el secret para que nadie externo pueda disparar alertas
  const secret = req.headers.get('x-webhook-secret')
  if (WEBHOOK_SECRET && secret !== WEBHOOK_SECRET) {
    return NextResponse.json({ error: 'Unauthorized' }, { status: 401 })
  }

  try {
    const body = await req.json()
    const record = body.record as {
      terminal_id: string
      status_previo: string | null
      status_nuevo: string
      created_at: string
    }

    if (!record?.terminal_id || !record?.status_nuevo) {
      return NextResponse.json({ error: 'Payload inválido' }, { status: 400 })
    }

    // Buscar alias del terminal para el mail (tabla pública, anon key suficiente)
    const supabase = createClient(
      process.env.NEXT_PUBLIC_SUPABASE_URL!,
      process.env.NEXT_PUBLIC_SUPABASE_ANON_KEY!
    )
    const { data: aliasData } = await supabase
      .from('dispositivo_alias')
      .select('alias')
      .eq('dispositivo_id', record.terminal_id)
      .single()

    await enviarAlertaTerminal({
      terminalId:   record.terminal_id,
      alias:        aliasData?.alias,
      statusPrevio: record.status_previo,
      statusNuevo:  record.status_nuevo,
      timestamp:    record.created_at,
    })

    return NextResponse.json({ ok: true })
  } catch (err) {
    console.error('[API/terminal-alert]', err)
    return NextResponse.json(
      { error: err instanceof Error ? err.message : 'Error interno' },
      { status: 500 }
    )
  }
}
