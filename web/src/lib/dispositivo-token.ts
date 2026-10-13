import { createHash, randomInt } from 'crypto'
import type { NextRequest } from 'next/server'
import { getSupabaseAdmin } from '@/lib/supabase-admin'

/**
 * Tokens de los teléfonos que mandan llamadas y heartbeats — SERVER ONLY.
 *
 * Cada terminal tiene un token propio que se carga una vez en la app. El
 * servidor deduce el dispositivo_id del token, así un teléfono no puede
 * escribir en nombre de otro. En la base solo se guarda el SHA-256.
 */

/** Base32 de Crockford: sin I, L, O ni U, para que se pueda tipear sin confundir. */
const ALFABETO = '0123456789ABCDEFGHJKMNPQRSTVWXYZ'

export const DISPOSITIVO_ID_RE = /^[A-Za-z0-9_-]{1,32}$/

/** 20 caracteres (100 bits) en grupos de 4: `7K2M-QX9P-…`. */
export function generarToken(): string {
  const chars = Array.from({ length: 20 }, () => ALFABETO[randomInt(ALFABETO.length)])
  return chars.join('').match(/.{4}/g)!.join('-')
}

/**
 * Hash del token en forma canónica: mayúsculas, sin guiones ni espacios, y con
 * los caracteres ambiguos que alguien pudo tipear mal (O → 0, I/L → 1).
 */
export function hashToken(token: string): string {
  const canonico = token
    .toUpperCase()
    .replace(/[^0-9A-Z]/g, '')
    .replace(/O/g, '0')
    .replace(/[IL]/g, '1')
  return createHash('sha256').update(canonico).digest('hex')
}

/** dispositivo_id dueño del `Authorization: Bearer <token>`, o null. */
export async function dispositivoDesdeRequest(req: NextRequest): Promise<string | null> {
  const auth = req.headers.get('authorization') ?? ''
  const match = /^Bearer\s+(.+)$/i.exec(auth)
  if (!match) return null

  const db = getSupabaseAdmin()
  const { data, error } = await db
    .from('dispositivo_tokens')
    .select('dispositivo_id')
    .eq('token_hash', hashToken(match[1]))
    .maybeSingle()
  if (error) throw new Error(`[dispositivo-token] ${error.message}`)
  if (!data) return null

  await db
    .from('dispositivo_tokens')
    .update({ ultimo_uso_at: new Date().toISOString() })
    .eq('dispositivo_id', data.dispositivo_id)

  return data.dispositivo_id
}
