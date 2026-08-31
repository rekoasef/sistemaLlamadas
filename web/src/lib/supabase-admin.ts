import { createClient, type SupabaseClient } from '@supabase/supabase-js'
import type { Database } from '@/types/supabase'

/**
 * Service-role Supabase client — SERVER ONLY.
 *
 * Los route handlers de cron corren sin sesión de usuario, así que el cliente
 * compartido de `@/lib/supabase` los deja como rol `anon` y RLS rechaza toda
 * escritura con el código 42501 (por ejemplo insertReporte sobre
 * `reportes_generados`). Este cliente usa la service role key, que hace bypass
 * de RLS, y por eso NUNCA puede llegar al browser.
 *
 * La key se lee de SUPABASE_SERVICE_ROLE_KEY (sin prefijo NEXT_PUBLIC_, para
 * que Next no la inyecte en el bundle del cliente).
 */
let cached: SupabaseClient<Database> | null = null

export function getSupabaseAdmin(): SupabaseClient<Database> {
  if (typeof window !== 'undefined') {
    throw new Error('[supabase-admin] El cliente service-role no puede usarse en el browser')
  }

  if (cached) return cached

  const url = process.env.NEXT_PUBLIC_SUPABASE_URL
  const serviceRoleKey = process.env.SUPABASE_SERVICE_ROLE_KEY

  if (!url || !serviceRoleKey) {
    throw new Error(
      '[supabase-admin] Falta SUPABASE_SERVICE_ROLE_KEY (o NEXT_PUBLIC_SUPABASE_URL). ' +
        'Sin ella los crons escriben como rol anon y RLS los rechaza con 42501.'
    )
  }

  cached = createClient<Database>(url, serviceRoleKey, {
    auth: { persistSession: false, autoRefreshToken: false },
  })
  return cached
}
