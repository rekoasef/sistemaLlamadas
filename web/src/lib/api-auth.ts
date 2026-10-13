import { timingSafeEqual } from 'crypto'
import { NextResponse } from 'next/server'
import { createSupabaseServerClient } from '@/lib/supabase-server'

/**
 * Guards para los route handlers de `/api/*` — SERVER ONLY.
 *
 * El middleware deja pasar todo `/api/*` sin sesión (los crons y el webhook de
 * Supabase no tienen cookies), así que cada handler tiene que autenticarse solo.
 * Todos los chequeos son fail-closed: si falta la variable de entorno del
 * secret, se rechaza en vez de dejar pasar.
 */

/** Respuesta 401 uniforme. */
export function unauthorized(): NextResponse {
  return NextResponse.json({ error: 'No autorizado' }, { status: 401 })
}

/**
 * Loguea el error completo y devuelve un mensaje genérico, para no filtrar
 * detalles internos (credenciales SMTP, errores de Postgres, stack) al cliente.
 */
export function serverError(label: string, err: unknown, mensaje: string): NextResponse {
  console.error(label, err)
  return NextResponse.json({ error: mensaje }, { status: 500 })
}

/** Compara en tiempo constante. `false` si alguno está vacío. */
function secretMatches(received: string | null, expected: string | undefined): boolean {
  if (!received || !expected) return false
  const a = Buffer.from(received)
  const b = Buffer.from(expected)
  return a.length === b.length && timingSafeEqual(a, b)
}

/** Header `Authorization: Bearer <CRON_SECRET>`, como lo manda Vercel Cron. */
export function isCronAuthorized(authHeader: string | null): boolean {
  const secret = process.env.CRON_SECRET
  if (!secret) {
    console.error('[api-auth] Falta CRON_SECRET: se rechazan todas las llamadas a los crons')
  }
  return secretMatches(authHeader, secret ? `Bearer ${secret}` : undefined)
}

/** Header `x-webhook-secret` que manda el Database Webhook de Supabase. */
export function isWebhookAuthorized(secretHeader: string | null): boolean {
  const secret = process.env.TERMINAL_ALERT_WEBHOOK_SECRET
  if (!secret) {
    console.error('[api-auth] Falta TERMINAL_ALERT_WEBHOOK_SECRET: se rechazan todos los webhooks')
  }
  return secretMatches(secretHeader, secret)
}

/** `true` si la request trae una sesión de Supabase válida (verificada en el servidor). */
export async function hasUserSession(): Promise<boolean> {
  const supabase = createSupabaseServerClient()
  const {
    data: { user },
  } = await supabase.auth.getUser()
  return user !== null
}
